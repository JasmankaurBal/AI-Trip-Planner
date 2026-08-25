"""Trip collaboration: invite members, suggestions, votes, comments."""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import db_dep, get_current_user, get_owned_trip, oid
from app.schemas.misc import InviteRequest

router = APIRouter(prefix="/api/trips", tags=["collaboration"])


@router.get("/{trip_id}/members")
async def list_members(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db)
    ids = [trip["owner_id"]] + trip.get("member_ids", [])
    members = []
    async for u in db.users.find({"_id": {"$in": ids}}):
        members.append({
            "id": str(u["_id"]), "name": u.get("name"), "email": u["email"],
            "picture": u.get("picture"),
            "role": "owner" if str(u["_id"]) == str(trip["owner_id"]) else "member",
        })
    return {"members": members}


@router.post("/{trip_id}/invite")
async def invite_member(trip_id: str, payload: InviteRequest, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db)
    if str(trip["owner_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can invite members")
    invitee = await db.users.find_one({"email": payload.email.lower().strip()})
    if not invitee:
        raise HTTPException(status_code=404, detail="No COCO user with that email. They must sign up first.")
    if str(invitee["_id"]) == user["id"]:
        raise HTTPException(status_code=422, detail="You are already on this trip")
    await db.trips.update_one({"_id": oid(trip_id)}, {"$addToSet": {"member_ids": invitee["_id"]}})
    await db.notifications.insert_one({
        "user_id": str(invitee["_id"]), "type": "trip_invite",
        "message": f"{user.get('name')} added you to '{trip.get('title')}'",
        "trip_id": trip_id, "read": False, "created_at": datetime.now(timezone.utc),
    })
    return {"ok": True, "invited": payload.email}


@router.delete("/{trip_id}/members/{member_id}")
async def remove_member(trip_id: str, member_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db)
    if str(trip["owner_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can remove members")
    await db.trips.update_one({"_id": oid(trip_id)}, {"$pull": {"member_ids": ObjectId(member_id)}})
    return {"ok": True}


@router.get("/{trip_id}/suggestions")
async def list_suggestions(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)
    items = []
    async for s in db.trip_suggestions.find({"trip_id": oid(trip_id)}).sort("created_at", -1):
        items.append({
            "id": str(s["_id"]), "text": s["text"], "author": s.get("author_name"),
            "votes": s.get("votes", []), "vote_count": len(s.get("votes", [])),
            "created_at": s["created_at"].isoformat() if isinstance(s.get("created_at"), datetime) else s.get("created_at"),
        })
    return {"suggestions": items}


@router.post("/{trip_id}/suggestions", status_code=201)
async def add_suggestion(trip_id: str, payload: dict, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="Suggestion text required")
    doc = {"trip_id": oid(trip_id), "text": text, "author_id": user["id"],
           "author_name": user.get("name"), "votes": [], "created_at": datetime.now(timezone.utc)}
    res = await db.trip_suggestions.insert_one(doc)
    return {"id": str(res.inserted_id), "text": text, "votes": [], "vote_count": 0, "author": user.get("name")}


@router.post("/{trip_id}/suggestions/{sug_id}/vote")
async def vote_suggestion(trip_id: str, sug_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)
    sug = await db.trip_suggestions.find_one({"_id": oid(sug_id), "trip_id": oid(trip_id)})
    if not sug:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    if user["id"] in sug.get("votes", []):
        await db.trip_suggestions.update_one({"_id": oid(sug_id)}, {"$pull": {"votes": user["id"]}})
        voted = False
    else:
        await db.trip_suggestions.update_one({"_id": oid(sug_id)}, {"$addToSet": {"votes": user["id"]}})
        voted = True
    updated = await db.trip_suggestions.find_one({"_id": oid(sug_id)})
    return {"voted": voted, "vote_count": len(updated.get("votes", []))}
