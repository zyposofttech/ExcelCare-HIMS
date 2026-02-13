"""Code Suggester Engine — LOINC/CPT/SNOMED code suggestion for services."""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field

from src.collectors.models import BranchContext


class CodeSuggestion(BaseModel):
    system: str  # LOINC, CPT, SNOMED, ICD10-PCS
    code: str
    display: str
    confidence: float  # 0..1
    matchReason: str


class CodeSuggesterResult(BaseModel):
    serviceName: str
    category: str | None = None
    suggestions: list[CodeSuggestion] = Field(default_factory=list)


# Lightweight heuristic mapping (no external API needed)
_CATEGORY_SYSTEM_MAP: dict[str, str] = {
    "LAB": "LOINC",
    "LABORATORY": "LOINC",
    "RADIOLOGY": "SNOMED",
    "PROCEDURE": "CPT",
    "SURGERY": "CPT",
    "CONSULTATION": "CPT",
    "NURSING": "SNOMED",
    "PHYSIOTHERAPY": "CPT",
    "OTHER": "SNOMED",
}

_COMMON_CODES: dict[str, list[dict[str, str]]] = {
    "complete blood count": [
        {"system": "LOINC", "code": "58410-2", "display": "CBC panel - Blood by Automated count"},
    ],
    "blood glucose": [
        {"system": "LOINC", "code": "2345-7", "display": "Glucose [Mass/volume] in Serum or Plasma"},
    ],
    "chest xray": [
        {"system": "SNOMED", "code": "399208008", "display": "Plain chest X-ray"},
    ],
    "ecg": [
        {"system": "CPT", "code": "93000", "display": "Electrocardiogram routine with interpretation"},
    ],
    "consultation": [
        {"system": "CPT", "code": "99213", "display": "Office/outpatient visit, established patient"},
    ],
}


def suggest_codes(
    service_name: str,
    category: str | None = None,
    ctx: BranchContext | None = None,
) -> CodeSuggesterResult:
    """Suggest medical codes (LOINC/CPT/SNOMED) for a service name."""
    suggestions: list[CodeSuggestion] = []
    name_lower = service_name.lower().strip()

    # Check direct matches
    for key, codes in _COMMON_CODES.items():
        if key in name_lower or name_lower in key:
            for c in codes:
                suggestions.append(CodeSuggestion(
                    system=c["system"],
                    code=c["code"],
                    display=c["display"],
                    confidence=0.85 if key == name_lower else 0.6,
                    matchReason=f"Matched common code for '{key}'",
                ))

    # Suggest system based on category
    if not suggestions and category:
        system = _CATEGORY_SYSTEM_MAP.get(category.upper(), "SNOMED")
        suggestions.append(CodeSuggestion(
            system=system,
            code="",
            display=f"Suggested system: {system} (lookup required)",
            confidence=0.3,
            matchReason=f"Category '{category}' maps to {system}",
        ))

    return CodeSuggesterResult(
        serviceName=service_name,
        category=category,
        suggestions=suggestions[:5],
    )
