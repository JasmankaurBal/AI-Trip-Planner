"""Shared Pydantic base models and ObjectId handling."""
from datetime import datetime, timezone
from typing import Annotated, Any

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str):
        return v
    raise ValueError("Invalid ObjectId")


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utcnow().isoformat()


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId | None = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict | None):
        if not doc:
            return None
        return cls(**doc)

    def to_mongo(self, exclude_none: bool = True) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=exclude_none)
        data.pop("_id", None)
        return data
