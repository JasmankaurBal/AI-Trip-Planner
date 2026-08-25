from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=6, max_length=128)


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str = "user"
    picture: str | None = None
    auth_provider: str = "password"

    @field_validator("picture", mode="before")
    @classmethod
    def _blank_picture(cls, v):
        return v or None
