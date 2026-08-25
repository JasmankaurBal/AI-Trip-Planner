"""Persistent AI chat companion with trip context (SSE streaming)."""
import json
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import db_dep, get_current_user, get_owned_trip, oid
from app.core.logging import logger
from app.schemas.chat import ChatRequest
from app.services import ai_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def _build_trip_context(trip_id: str, user: dict, db) -> str | None:
    try:
        trip = await get_owned_trip(trip_id, user, db)
    except HTTPException:
        return None
    acts = [a async for a in db.activities.find({"trip_id": oid(trip_id)}).sort([("day_index", 1), ("order", 1)])]
    lines = [
        f"Trip: {trip.get('title')} to {trip.get('destination')}",
        f"Dates: {trip['start_date'].date()} to {trip['end_date'].date()}",
        f"Travelers: {trip.get('travelers')}, Budget: {trip.get('budget')} {trip.get('currency')}",
    ]
    by_day: dict[int, list[str]] = {}
    for a in acts:
        by_day.setdefault(a["day_index"], []).append(f"[{a.get('_id')}] {a['title']} ({a.get('category')})")
    for day in sorted(by_day):
        lines.append(f"Day {day + 1}: " + "; ".join(by_day[day]))
    return "\n".join(lines)


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    conv = await db.chat_conversations.find_one({"_id": oid(conversation_id), "user_id": user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = []
    async for m in db.chat_messages.find({"conversation_id": conversation_id}).sort("created_at", 1):
        msgs.append({"role": m["role"], "content": m["content"],
                     "created_at": m["created_at"].isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at")})
    return {"id": conversation_id, "trip_id": conv.get("trip_id"), "title": conv.get("title"), "messages": msgs}


@router.get("")
async def list_conversations(trip_id: str | None = None, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    query = {"user_id": user["id"]}
    if trip_id:
        query["trip_id"] = trip_id
    convs = []
    async for c in db.chat_conversations.find(query).sort("updated_at", -1):
        convs.append({"id": str(c["_id"]), "trip_id": c.get("trip_id"), "title": c.get("title"),
                      "updated_at": c["updated_at"].isoformat() if isinstance(c.get("updated_at"), datetime) else c.get("updated_at")})
    return {"conversations": convs}


@router.post("")
async def chat(payload: ChatRequest, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    # resolve or create conversation
    if payload.conversation_id:
        conv = await db.chat_conversations.find_one({"_id": oid(payload.conversation_id), "user_id": user["id"]})
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation_id = payload.conversation_id
    else:
        now = datetime.now(timezone.utc)
        res = await db.chat_conversations.insert_one({
            "user_id": user["id"], "trip_id": payload.trip_id,
            "title": payload.message[:48], "created_at": now, "updated_at": now,
        })
        conversation_id = str(res.inserted_id)

    # load recent history
    history = []
    async for m in db.chat_messages.find({"conversation_id": conversation_id}).sort("created_at", 1):
        history.append({"role": m["role"], "content": m["content"]})

    trip_context = None
    trip_id = payload.trip_id or (await db.chat_conversations.find_one({"_id": oid(conversation_id)})).get("trip_id")
    if trip_id:
        trip_context = await _build_trip_context(trip_id, user, db)

    system = ai_service.build_chat_system(trip_context, history)

    # persist user message
    now = datetime.now(timezone.utc)
    await db.chat_messages.insert_one({
        "conversation_id": conversation_id, "role": "user",
        "content": payload.message, "created_at": now,
    })

    async def event_gen():
        yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation_id})}\n\n"
        collected = []
        try:
            async for token in ai_service.chat_stream(f"chat-{conversation_id}", system, payload.message):
                collected.append(token)
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except Exception as exc:  # noqa: BLE001
            logger.error(f"Chat stream error: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'content': 'COCO is unavailable right now. Please try again.'})}\n\n"
        full = "".join(collected)
        if full:
            await db.chat_messages.insert_one({
                "conversation_id": conversation_id, "role": "assistant",
                "content": full, "created_at": datetime.now(timezone.utc),
            })
            await db.chat_conversations.update_one({"_id": ObjectId(conversation_id)}, {"$set": {"updated_at": datetime.now(timezone.utc)}})
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    conv = await db.chat_conversations.find_one({"_id": oid(conversation_id), "user_id": user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.chat_conversations.delete_one({"_id": oid(conversation_id)})
    await db.chat_messages.delete_many({"conversation_id": conversation_id})
    return {"ok": True}
