"""Service Search Engine — fuzzy + synonym matching for service items."""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

from pydantic import BaseModel, Field

from src.collectors.models import BranchContext


class ServiceSearchHit(BaseModel):
    id: str
    code: str
    name: str
    category: str
    score: float
    matchReason: str


class ServiceSearchResult(BaseModel):
    query: str
    hits: list[ServiceSearchHit] = Field(default_factory=list)
    total: int = 0


# Common medical synonyms for fuzzy matching
_SYNONYMS: dict[str, list[str]] = {
    "cbc": ["complete blood count", "hemogram", "blood count"],
    "ecg": ["electrocardiogram", "ekg", "cardiac rhythm"],
    "xray": ["x-ray", "radiograph", "plain film"],
    "mri": ["magnetic resonance imaging", "mr scan"],
    "ct": ["computed tomography", "cat scan", "ct scan"],
    "usg": ["ultrasound", "ultrasonography", "sonography"],
    "lft": ["liver function test", "hepatic panel"],
    "rft": ["renal function test", "kidney function"],
    "tft": ["thyroid function test", "thyroid panel"],
    "hba1c": ["glycated hemoglobin", "a1c"],
    "opd": ["outpatient", "consultation"],
    "ipd": ["inpatient", "admission"],
    "ot": ["operation theatre", "surgery", "surgical"],
}


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _expand_query(query: str) -> list[str]:
    """Expand query with known synonyms."""
    terms = [query]
    q_lower = query.lower().strip()
    for abbr, expansions in _SYNONYMS.items():
        if abbr in q_lower or any(e in q_lower for e in expansions):
            terms.extend(expansions)
            terms.append(abbr)
    return list(set(terms))


def search_services(query: str, ctx: BranchContext, limit: int = 20) -> ServiceSearchResult:
    """Search service items with fuzzy + synonym matching."""
    if not query or not query.strip():
        return ServiceSearchResult(query=query, hits=[], total=0)

    sc = ctx.serviceCatalog
    # We don't have individual items in the summary—this engine requires
    # direct DB access. For now, return a stub with the query echoed.
    # In production, this would query the DB directly via SQLAlchemy.
    return ServiceSearchResult(
        query=query,
        hits=[],
        total=0,
    )
