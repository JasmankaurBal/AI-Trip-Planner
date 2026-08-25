"""Centralised application settings loaded from environment variables."""
import os


class Settings:
    def __init__(self) -> None:
        self.MONGO_URL: str = os.environ["MONGO_URL"]
        self.DB_NAME: str = os.environ["DB_NAME"]
        self.JWT_SECRET: str = os.environ["JWT_SECRET"]
        if len(self.JWT_SECRET) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        self.JWT_ALGORITHM: str = "HS256"
        self.ACCESS_TOKEN_MINUTES: int = 60 * 24  # 1 day
        self.REFRESH_TOKEN_DAYS: int = 7
        self.ADMIN_EMAIL: str = os.environ.get("ADMIN_EMAIL", "").lower().strip()
        self.ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "")
        self.GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")
        self.AI_MODEL: str = os.environ.get("AI_MODEL", "gemini-3-flash-preview")
        self.FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        self.ALLOWED_ORIGINS: str = os.environ.get("ALLOWED_ORIGINS", "")
        self.GOOGLE_CLIENT_ID: str = os.environ.get("GOOGLE_CLIENT_ID", "")
        self.GOOGLE_CLIENT_SECRET: str = os.environ.get("GOOGLE_CLIENT_SECRET", "")
        self.GOOGLE_REDIRECT_URI: str = os.environ.get("GOOGLE_REDIRECT_URI", "")
        self.RESEND_API_KEY: str = os.environ.get("RESEND_API_KEY", "")
        self.EMAIL_FROM: str = os.environ.get("EMAIL_FROM", "")
        self.COOKIE_SECURE: bool = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
        self.COOKIE_SAMESITE: str = os.environ.get("COOKIE_SAMESITE", "lax").lower()
        self.COOKIE_DOMAIN: str | None = os.environ.get("COOKIE_DOMAIN") or None

    @property
    def cors_origins(self) -> list[str]:
        configured = [item.strip().rstrip("/") for item in self.ALLOWED_ORIGINS.split(",") if item.strip()]
        defaults = [self.FRONTEND_URL]
        if self.FRONTEND_URL.startswith("http://localhost"):
            defaults.append("http://localhost:3000")
        return list(dict.fromkeys([*defaults, *configured]))


settings = Settings()
