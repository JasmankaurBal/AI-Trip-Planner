"""Structured, secret-safe application logging."""
import logging
import sys

_SENSITIVE = ("password", "token", "secret", "authorization", "api_key", "jwt")


def get_logger(name: str = "coco") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


def safe_extra(data: dict) -> dict:
    """Strip sensitive keys before logging a dict."""
    return {k: ("***" if any(s in k.lower() for s in _SENSITIVE) else v) for k, v in data.items()}


logger = get_logger()
