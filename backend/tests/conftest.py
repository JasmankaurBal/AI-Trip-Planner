"""Load backend .env so modules relying on env vars import cleanly during tests."""
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
