"""Duplicate Detector Engine — name similarity analysis for services."""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from pydantic import BaseModel, Field

from src.collectors.models import BranchContext


class DuplicatePair(BaseModel):
    itemA: str  # name
    itemACode: str
    itemB: str  # name
    itemBCode: str
    similarity: float  # 0..1
    reason: str


class DuplicateDetectorResult(BaseModel):
    totalItemsChecked: int = 0
    potentialDuplicates: list[DuplicatePair] = Field(default_factory=list)
    highConfidence: int = 0  # similarity > 0.85
    mediumConfidence: int = 0  # similarity 0.7-0.85


def _normalize(name: str) -> str:
    """Normalize a service name for comparison."""
    n = name.lower().strip()
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    # Remove common noise words
    for noise in ("test", "procedure", "service", "investigation"):
        n = n.replace(noise, "").strip()
    return n


def detect_duplicates(ctx: BranchContext, threshold: float = 0.7) -> DuplicateDetectorResult:
    """Detect potential duplicate services based on name similarity.

    This is a heuristic engine. For the lightweight context-based approach,
    we analyze the category distribution and flag potential issues. Full
    duplicate detection would require item-level data from the DB.
    """
    sc = ctx.serviceCatalog
    result = DuplicateDetectorResult(totalItemsChecked=sc.totalServiceItems)

    # Without individual item names in the summary, we can only flag
    # categories that might contain duplicates due to high item counts
    for cat, count in sc.byCategory.items():
        if count > 50:
            result.potentialDuplicates.append(DuplicatePair(
                itemA=f"[{count} items in {cat}]",
                itemACode="",
                itemB="[recommend detailed scan]",
                itemBCode="",
                similarity=0.0,
                reason=f"Category '{cat}' has {count} items — manual review recommended",
            ))

    return result
