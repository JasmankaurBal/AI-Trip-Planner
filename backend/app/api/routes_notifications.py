"""Notifications feed."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import db_dep, get_current_user, oid

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    items = []
    async for n in db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(50):
        items.append({
            "id": str(n["_id"]), "type": n.get("type"), "message": n.get("message"),
            "trip_id": n.get("trip_id"), "read": n.get("read", False),
            "created_at": n["created_at"].isoformat() if isinstance(n.get("created_at"), datetime) else n.get("created_at"),
        })
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"notifications": items, "unread": unread}


@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await db.notifications.update_one({"_id": oid(notif_id), "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}
