from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    trip_id: Optional[str] = None
    conversation_id: Optional[str] = None
