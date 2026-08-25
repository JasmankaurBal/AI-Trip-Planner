from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

EXPENSE_CATEGORIES = [
    "accommodation", "transport", "food", "activities",
    "shopping", "miscellaneous", "emergency",
]


class ExpenseCreate(BaseModel):
    amount: float = Field(gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    category: str = "miscellaneous"
    description: Optional[str] = ""
    date: Optional[date] = None
    payer: Optional[str] = None  # member name/email
    split_between: list[str] = Field(default_factory=list)


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, gt=0)
    currency: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[date] = None
    payer: Optional[str] = None
    split_between: Optional[list[str]] = None
