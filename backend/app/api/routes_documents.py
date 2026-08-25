"""Travel document vault (metadata + access control). File blobs require object storage (not configured)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import db_dep, get_current_user, oid
from app.schemas.misc import DocumentCreate

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _ser(d: dict) -> dict:
    d = dict(d)
    d["id"] = str(d.pop("_id"))
    if isinstance(d.get("created_at"), datetime):
        d["created_at"] = d["created_at"].isoformat()
    return d


@router.get("")
async def list_documents(trip_id: str | None = None, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    query = {"user_id": user["id"]}
    if trip_id:
        query["trip_id"] = trip_id
    cursor = db.travel_documents.find(query).sort("created_at", -1)
    return {"documents": [_ser(d) async for d in cursor]}


@router.post("", status_code=201)
async def create_document(payload: DocumentCreate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    doc = {
        "user_id": user["id"],
        "name": payload.name,
        "doc_type": payload.doc_type,
        "trip_id": payload.trip_id,
        "expiry_date": payload.expiry_date,
        "number": payload.number,
        "notes": payload.notes,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.travel_documents.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _ser(doc)


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    result = await db.travel_documents.delete_one({"_id": oid(doc_id), "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"ok": True}
