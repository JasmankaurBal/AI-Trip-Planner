"""Authentication: password accounts and Google OAuth."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import db_dep, get_current_user
from app.core.config import settings
from app.core.logging import logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserPublic,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

LOCKOUT_THRESHOLD = 5
LOCKOUT_MINUTES = 15


def _public(user: dict) -> dict:
    return UserPublic(
        id=str(user["_id"]),
        name=user.get("name", ""),
        email=user["email"],
        role=user.get("role", "user"),
        picture=user.get("picture"),
        auth_provider=user.get("auth_provider", "password"),
    ).model_dump()


def _set_auth_cookies(response: Response, user_id: str, email: str) -> None:
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    common = dict(
        httponly=True, secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN, path="/",
    )
    response.set_cookie("access_token", access, max_age=settings.ACCESS_TOKEN_MINUTES * 60, **common)
    response.set_cookie("refresh_token", refresh, max_age=settings.REFRESH_TOKEN_DAYS * 86400, **common)


@router.post("/register")
async def register(payload: RegisterRequest, response: Response, db: AsyncIOMotorDatabase = Depends(db_dep)):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    doc = {
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": "user",
        "auth_provider": "password",
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    _set_auth_cookies(response, str(res.inserted_id), email)
    logger.info(f"User registered: {email}")
    user = _public(doc)
    return user


@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response, db: AsyncIOMotorDatabase = Depends(db_dep)):
    email = payload.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= LOCKOUT_THRESHOLD:
        locked_until = attempt.get("locked_until")
        if locked_until and locked_until.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})
    _set_auth_cookies(response, str(user["_id"]), email)
    logger.info(f"User login: {email}")
    return _public(user)


@router.get("/google/start")
async def google_start():
    if not all((settings.GOOGLE_CLIENT_ID, settings.GOOGLE_REDIRECT_URI)):
        raise HTTPException(
            status_code=503,
            detail="Google sign-in is not configured"
        )

    state = secrets.token_urlsafe(32)

    params = urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    })

    from fastapi.responses import RedirectResponse

    redirect = RedirectResponse(
        f"https://accounts.google.com/o/oauth2/v2/auth?{params}",
        status_code=307,
    )

    redirect.set_cookie(
        "oauth_state",
        state,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=600,
        path="/",
    )

    return redirect


@router.get("/google/callback")
async def google_callback(code: str, state: str, request: Request, db: AsyncIOMotorDatabase = Depends(db_dep)):
    from fastapi.responses import RedirectResponse
    if not secrets.compare_digest(state, request.cookies.get("oauth_state", "")):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    if not all((settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET, settings.GOOGLE_REDIRECT_URI)):
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            token_response = await client.post("https://oauth2.googleapis.com/token", data={
                "code": code, "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI, "grant_type": "authorization_code",
            })
            token_response.raise_for_status()
            access_token = token_response.json()["access_token"]
            user_response = await client.get("https://openidconnect.googleapis.com/v1/userinfo", headers={"Authorization": f"Bearer {access_token}"})
            user_response.raise_for_status()
            data = user_response.json()
    except Exception as exc:  # noqa: BLE001
        logger.error("Google OAuth exchange failed: %s", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Google sign-in failed")

    if data.get("email_verified") is not True or not data.get("sub"):
        raise HTTPException(status_code=401, detail="Google account is not verified")
    email = (data.get("email") or "").lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        doc = {
            "name": data.get("name") or email.split("@")[0],
            "email": email,
            "password_hash": None,
            "role": "user",
            "auth_provider": "google",
            "google_sub": data["sub"], "picture": data.get("picture"),
            "created_at": datetime.now(timezone.utc),
        }
        res = await db.users.insert_one(doc)
        doc["_id"] = res.inserted_id
        user = doc
    else:
        if user.get("auth_provider") == "google" and user.get("google_sub") != data["sub"]:
            raise HTTPException(status_code=409, detail="Google account does not match this account")
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"google_sub": data["sub"], "auth_provider": "google"}})
    redirect = RedirectResponse(f"{settings.FRONTEND_URL}/app", status_code=303)
    _set_auth_cookies(redirect, str(user["_id"]), email)
    redirect.delete_cookie("oauth_state", path="/", domain=settings.COOKIE_DOMAIN)
    logger.info(f"Google login: {email}")
    return redirect


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncIOMotorDatabase = Depends(db_dep)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    _set_auth_cookies(response, str(user["_id"]), user["email"])
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    for c in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(c, path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(
        id=user["id"], name=user.get("name", ""), email=user["email"],
        role=user.get("role", "user"), picture=user.get("picture"),
        auth_provider=user.get("auth_provider", "password"),
    ).model_dump()


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncIOMotorDatabase = Depends(db_dep)):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        now = datetime.now(timezone.utc)
        await db.password_reset_tokens.update_many({"user_id": str(user["_id"]), "used": False}, {"$set": {"used": True}})
        await db.password_reset_tokens.insert_one({
            "token_hash": token_hash, "user_id": str(user["_id"]), "created_at": now,
            "expires_at": now + timedelta(hours=1), "used": False,
        })
        if not settings.RESEND_API_KEY or not settings.EMAIL_FROM:
            logger.error("Password reset email is not configured")
        else:
            link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    email_response = await client.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"}, json={
                        "from": settings.EMAIL_FROM, "to": [email], "subject": "Reset your COCO password",
                        "html": f"<p>We received a request to reset your COCO password.</p><p><a href=\"{link}\">Reset your password</a></p><p>This link expires in one hour.</p>",
                        "text": f"Reset your COCO password: {link}\nThis link expires in one hour.",
                    })
                    email_response.raise_for_status()
            except Exception as exc:  # noqa: BLE001
                logger.error("Password reset email delivery failed: %s", type(exc).__name__)
    return {"message": "If an account exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncIOMotorDatabase = Depends(db_dep)):
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    rec = await db.password_reset_tokens.find_one({"token_hash": token_hash, "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    exp = rec["expires_at"].replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token expired")
    await db.users.update_one({"_id": ObjectId(rec["user_id"])}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"message": "Password updated"}
