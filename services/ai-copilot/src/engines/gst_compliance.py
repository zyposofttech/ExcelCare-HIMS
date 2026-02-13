"""GST Compliance Engine — auto GST/SAC classification for services."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from src.collectors.models import BranchContext


class GSTClassification(BaseModel):
    category: str
    sacCode: str
    gstRate: float  # e.g., 5.0, 12.0, 18.0
    description: str
    exemptionNote: str | None = None


class GSTComplianceResult(BaseModel):
    serviceName: str
    category: str | None = None
    classification: GSTClassification | None = None
    warnings: list[str] = Field(default_factory=list)
    taxCodesConfigured: int = 0


# SAC code mapping for healthcare services (India GST)
_SAC_MAP: dict[str, GSTClassification] = {
    "LAB": GSTClassification(
        category="LAB",
        sacCode="998931",
        gstRate=18.0,
        description="Medical testing and analysis services",
        exemptionNote="Exempt under Sl. No. 74 of notification 12/2017 if provided by clinical establishment",
    ),
    "RADIOLOGY": GSTClassification(
        category="RADIOLOGY",
        sacCode="998931",
        gstRate=18.0,
        description="Radiological imaging services",
        exemptionNote="Exempt if part of healthcare services by clinical establishment",
    ),
    "CONSULTATION": GSTClassification(
        category="CONSULTATION",
        sacCode="998931",
        gstRate=0.0,
        description="Clinical consultation (healthcare service)",
        exemptionNote="Healthcare services are exempt under entry 74 — no GST if by clinical establishment",
    ),
    "PROCEDURE": GSTClassification(
        category="PROCEDURE",
        sacCode="998931",
        gstRate=0.0,
        description="Medical/surgical procedure",
        exemptionNote="Exempt if part of healthcare services",
    ),
    "SURGERY": GSTClassification(
        category="SURGERY",
        sacCode="998931",
        gstRate=0.0,
        description="Surgical procedure (healthcare service)",
        exemptionNote="Healthcare services are exempt under GST",
    ),
    "PHARMACY": GSTClassification(
        category="PHARMACY",
        sacCode="",
        gstRate=12.0,
        description="Pharmaceutical products",
        exemptionNote="Drugs & medicines: 5%/12% depending on classification",
    ),
    "ROOM_RENT": GSTClassification(
        category="ROOM_RENT",
        sacCode="996311",
        gstRate=0.0,
        description="Room accommodation in hospital",
        exemptionNote="Exempt if room rent <= INR 5000/day (per GST Council, 47th meeting)",
    ),
    "OTHER": GSTClassification(
        category="OTHER",
        sacCode="998931",
        gstRate=18.0,
        description="Other healthcare-related service",
        exemptionNote="May be exempt if provided as part of healthcare",
    ),
}


def classify_gst(
    service_name: str,
    category: str | None = None,
    ctx: BranchContext | None = None,
) -> GSTComplianceResult:
    """Classify a service for GST/SAC code and rate."""
    warnings: list[str] = []
    cat_upper = (category or "OTHER").upper()

    classification = _SAC_MAP.get(cat_upper, _SAC_MAP["OTHER"])

    # Check if we can infer category from name
    name_lower = service_name.lower()
    if not category:
        if any(kw in name_lower for kw in ["lab", "blood", "test", "culture", "biopsy"]):
            classification = _SAC_MAP["LAB"]
        elif any(kw in name_lower for kw in ["xray", "x-ray", "mri", "ct", "ultrasound", "usg"]):
            classification = _SAC_MAP["RADIOLOGY"]
        elif any(kw in name_lower for kw in ["consult", "opd", "visit"]):
            classification = _SAC_MAP["CONSULTATION"]
        elif any(kw in name_lower for kw in ["surgery", "operation"]):
            classification = _SAC_MAP["SURGERY"]
        elif any(kw in name_lower for kw in ["room", "bed", "ward"]):
            classification = _SAC_MAP["ROOM_RENT"]

    tax_count = 0
    if ctx:
        tax_count = ctx.serviceCatalog.totalTaxCodes
        if tax_count == 0:
            warnings.append("No tax codes configured in the system — GST billing will not work correctly")

    return GSTComplianceResult(
        serviceName=service_name,
        category=category,
        classification=classification,
        warnings=warnings,
        taxCodesConfigured=tax_count,
    )
