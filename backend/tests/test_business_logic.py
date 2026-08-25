"""Business-logic unit tests (no DB / network required)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ai_service import _normalize_itinerary, _extract_json  # noqa: E402


def test_extract_json_from_fenced():
    raw = 'Sure!\n```json\n{"a": 1, "days": []}\n```\nthanks'
    assert _extract_json(raw)["a"] == 1


def test_normalize_itinerary_coerces_and_filters():
    data = {
        "summary": "trip",
        "days": [
            {"title": "D1", "activities": [
                {"title": "Museum", "category": "culture", "lat": "38.7", "lng": "-9.1", "estimated_cost": "10", "duration_minutes": "90"},
                {"title": "", "category": "food"},  # dropped (no title)
                {"title": "Odd", "category": "invalid_cat"},  # -> other
            ]},
        ],
    }
    out = _normalize_itinerary(data, num_days=2)
    day0 = out["days"][0]
    assert len(day0["activities"]) == 2
    assert day0["activities"][0]["lat"] == 38.7
    assert day0["activities"][0]["estimated_cost"] == 10.0
    assert day0["activities"][1]["category"] == "other"


def test_settlement_math():
    """Simulate the greedy settlement used in routes_expenses."""
    balances = {"A": 30.0, "B": -10.0, "C": -20.0}
    creditors = [["A", 30.0]]
    debtors = [["C", 20.0], ["B", 10.0]]
    txns = []
    i = j = 0
    while i < len(debtors) and j < len(creditors):
        pay = round(min(debtors[i][1], creditors[j][1]), 2)
        if pay > 0:
            txns.append((debtors[i][0], creditors[j][0], pay))
        debtors[i][1] -= pay
        creditors[j][1] -= pay
        if debtors[i][1] <= 0.01:
            i += 1
        if creditors[j][1] <= 0.01:
            j += 1
    assert ("C", "A", 20.0) in txns
    assert ("B", "A", 10.0) in txns
