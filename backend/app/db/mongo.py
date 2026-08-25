"""MongoDB connection and index management (Motor async driver)."""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings
from app.core.logging import logger

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URL, uuidRepresentation="standard")
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.DB_NAME]


async def ping() -> bool:
    try:
        await get_client().admin.command("ping")
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error(f"MongoDB ping failed: {exc}")
        return False


async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.trips.create_index([("owner_id", 1), ("created_at", -1)])
    await db.trips.create_index("member_ids")
    await db.activities.create_index([("trip_id", 1), ("day_index", 1), ("order", 1)])
    await db.expenses.create_index([("trip_id", 1), ("date", -1)])
    await db.chat_conversations.create_index([("user_id", 1), ("trip_id", 1)])
    await db.chat_messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.saved_places.create_index([("user_id", 1)])
    await db.travel_documents.create_index([("user_id", 1), ("trip_id", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.trip_memories.create_index("trip_id")
    await db.packing_items.create_index([("trip_id", 1)])
    logger.info("MongoDB indexes ensured")
