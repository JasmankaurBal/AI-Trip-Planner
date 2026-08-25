from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    trip_id: Optional[str] = None
    conversation_id: Optional[str] = None


class PackingItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: Optional[str] = "general"
    quantity: int = Field(default=1, ge=1)


class PackingItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = Field(default=None, ge=1)
    checked: Optional[bool] = None


class DocumentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    doc_type: str = Field(min_length=1, max_length=60)
    trip_id: Optional[str] = None
    expiry_date: Optional[str] = None
    number: Optional[str] = None
    notes: Optional[str] = ""


class InviteRequest(BaseModel):
    email: str = Field(min_length=3, max_length=160)
    role: str = "member"


class MemoryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    note: Optional[str] = ""
    photos: list[str] = Field(default_factory=list)
    favorite_places: list[str] = Field(default_factory=list)
