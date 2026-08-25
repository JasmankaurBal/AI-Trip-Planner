from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class TripCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    destination: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date
    travelers: int = Field(default=1, ge=1, le=50)
    budget: Optional[float] = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    travel_style: Optional[str] = None
    interests: list[str] = Field(default_factory=list)
    dietary: Optional[str] = None
    accessibility: Optional[str] = None
    pace: Optional[str] = "moderate"
    # --- deep personalization (all optional) ---
    food_pref: Optional[str] = None
    accommodation_pref: Optional[str] = None
    walking_level: Optional[str] = None          # low | moderate | high
    luxury_level: Optional[str] = None           # budget | mid | luxury
    tourist_vs_local: Optional[int] = Field(default=None, ge=0, le=100)  # 0=tourist,100=local
    vibe: Optional[str] = None                    # relaxed | romantic | adventure | party ...


class TripUpdate(BaseModel):
    title: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    travelers: Optional[int] = Field(default=None, ge=1, le=50)
    budget: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    travel_style: Optional[str] = None
    interests: Optional[list[str]] = None
    dietary: Optional[str] = None
    accessibility: Optional[str] = None
    pace: Optional[str] = None
    status: Optional[str] = None
    food_pref: Optional[str] = None
    accommodation_pref: Optional[str] = None
    walking_level: Optional[str] = None
    luxury_level: Optional[str] = None
    tourist_vs_local: Optional[int] = Field(default=None, ge=0, le=100)
    vibe: Optional[str] = None


class ActivityCreate(BaseModel):
    day_index: int = Field(ge=0)
    title: str = Field(min_length=1, max_length=160)
    description: Optional[str] = ""
    location: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    start_time: Optional[str] = ""
    duration_minutes: int = Field(default=60, ge=0, le=1440)
    estimated_cost: float = Field(default=0, ge=0)
    category: str = "other"
    transport: Optional[str] = "none"
    notes: Optional[str] = ""


class ActivityUpdate(BaseModel):
    day_index: Optional[int] = Field(default=None, ge=0)
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    estimated_cost: Optional[float] = Field(default=None, ge=0)
    category: Optional[str] = None
    transport: Optional[str] = None
    notes: Optional[str] = None
    order: Optional[int] = None


class ReorderRequest(BaseModel):
    day_index: int = Field(ge=0)
    ordered_ids: list[str]


class BudgetUpdate(BaseModel):
    budget: float = Field(ge=0)
    breakdown: Optional[dict] = None
