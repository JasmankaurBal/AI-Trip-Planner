"""Expenses and group settlement calculation."""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import db_dep, get_current_user, get_owned_trip, oid
from app.schemas.expenses import EXPENSE_CATEGORIES, ExpenseCreate, ExpenseUpdate

router = APIRouter(prefix="/api/trips", tags=["expenses"])


def _ser(e: dict) -> dict:
    e = dict(e)
    e["id"] = str(e.pop("_id"))
    e["trip_id"] = str(e["trip_id"])
    d = e.get("date")
    if isinstance(d, datetime):
        e["date"] = d.date().isoformat()
    if isinstance(e.get("created_at"), datetime):
        e["created_at"] = e["created_at"].isoformat()
    return e


@router.get("/{trip_id}/expenses")
async def list_expenses(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)
    cursor = db.expenses.find({"trip_id": oid(trip_id)}).sort("date", -1)
    return {"expenses": [_ser(e) async for e in cursor]}


@router.post("/{trip_id}/expenses", status_code=201)
async def add_expense(trip_id: str, payload: ExpenseCreate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)  # members may add expenses
    if payload.category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Invalid category. Allowed: {EXPENSE_CATEGORIES}")
    d = payload.date or date.today()
    doc = {
        "trip_id": oid(trip_id),
        "amount": payload.amount,
        "currency": payload.currency.upper(),
        "category": payload.category,
        "description": payload.description or "",
        "date": datetime(d.year, d.month, d.day, tzinfo=timezone.utc),
        "payer": payload.payer or user.get("name") or user.get("email"),
        "split_between": payload.split_between,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.expenses.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _ser(doc)


@router.put("/{trip_id}/expenses/{expense_id}")
async def update_expense(trip_id: str, expense_id: str, payload: ExpenseUpdate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)
    updates = payload.model_dump(exclude_none=True)
    if "currency" in updates:
        updates["currency"] = updates["currency"].upper()
    if "date" in updates and isinstance(updates["date"], date):
        d = updates["date"]
        updates["date"] = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    result = await db.expenses.update_one({"_id": oid(expense_id), "trip_id": oid(trip_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return _ser(await db.expenses.find_one({"_id": oid(expense_id)}))


@router.delete("/{trip_id}/expenses/{expense_id}")
async def delete_expense(trip_id: str, expense_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)
    await db.expenses.delete_one({"_id": oid(expense_id), "trip_id": oid(trip_id)})
    return {"ok": True}


@router.get("/{trip_id}/settlements")
async def settlements(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    """Compute who owes whom using a minimal-transaction greedy settlement."""
    await get_owned_trip(trip_id, user, db)
    expenses = [e async for e in db.expenses.find({"trip_id": oid(trip_id)})]
    balances: dict[str, float] = {}
    for e in expenses:
        payer = e.get("payer") or "Unknown"
        participants = e.get("split_between") or [payer]
        share = e["amount"] / len(participants)
        balances[payer] = balances.get(payer, 0) + e["amount"]
        for p in participants:
            balances[p] = balances.get(p, 0) - share

    creditors = sorted([(p, b) for p, b in balances.items() if b > 0.01], key=lambda x: -x[1])
    debtors = sorted([(p, -b) for p, b in balances.items() if b < -0.01], key=lambda x: -x[1])
    transactions = []
    i = j = 0
    creditors = [list(c) for c in creditors]
    debtors = [list(d) for d in debtors]
    while i < len(debtors) and j < len(creditors):
        debtor, owe = debtors[i]
        creditor, due = creditors[j]
        pay = round(min(owe, due), 2)
        if pay > 0:
            transactions.append({"from": debtor, "to": creditor, "amount": pay})
        debtors[i][1] -= pay
        creditors[j][1] -= pay
        if debtors[i][1] <= 0.01:
            i += 1
        if creditors[j][1] <= 0.01:
            j += 1
    return {
        "balances": {p: round(b, 2) for p, b in balances.items()},
        "settlements": transactions,
    }
