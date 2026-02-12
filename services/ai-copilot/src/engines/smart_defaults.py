"""Smart Defaults Engine — context-aware defaults for entity creation.

When a user creates a room in an ICU unit, automatically suggests
oxygen=true, suction=true, monitor=true, maxOccupancy=1.
"""

from __future__ import annotations

from typing import Any


ICU_TYPES = {"ICU", "HDU", "CCU", "NICU", "PICU", "SICU", "MICU"}
CRITICAL_TYPES = ICU_TYPES | {"ER", "EMERGENCY", "OT", "PACU"}
WARD_TYPES = {"WARD", "GENERAL_WARD", "MATERNITY"}
OPD_TYPES = {"OPD", "CLINIC", "OUTPATIENT"}


def get_smart_defaults(
    entity_type: str,
    parent_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return suggested defaults + reasoning for a new entity."""
    ctx = parent_context or {}
    unit_type = (ctx.get("unitTypeCode") or "").upper()

    if entity_type == "room":
        return _room_defaults(unit_type, ctx)
    elif entity_type == "resource":
        return _resource_defaults(unit_type, ctx)
    elif entity_type == "unit":
        return _unit_defaults(ctx)
    elif entity_type == "specialty":
        return _specialty_defaults(ctx)
    elif entity_type == "department":
        return _department_defaults(ctx)
    elif entity_type == "unitType":
        return _unit_type_defaults(ctx)
    elif entity_type == "pharmacy-store":
        return _pharmacy_store_defaults(ctx)
    elif entity_type == "drug":
        return _drug_defaults(ctx)
    elif entity_type == "inventory-config":
        return _inventory_config_defaults(ctx)
    elif entity_type == "formulary-item":
        return _formulary_item_defaults(ctx)
    else:
        return {"defaults": {}, "reasoning": "No smart defaults for this entity type."}


def _room_defaults(unit_type: str, ctx: dict[str, Any]) -> dict[str, Any]:
    if unit_type in ICU_TYPES:
        return {
            "defaults": {
                "hasOxygen": True,
                "hasSuction": True,
                "hasMonitor": True,
                "hasVentilator": True,
                "hasCallButton": True,
                "maxOccupancy": 1,
                "roomType": "PATIENT_ROOM",
            },
            "reasoning": (
                "ICU rooms require oxygen supply, suction, cardiac monitoring, "
                "and ventilator readiness per NABH. Single occupancy recommended "
                "for infection control and patient safety."
            ),
        }

    if unit_type in {"ER", "EMERGENCY"}:
        return {
            "defaults": {
                "hasOxygen": True,
                "hasSuction": True,
                "hasMonitor": True,
                "hasCallButton": True,
                "maxOccupancy": 2,
                "roomType": "PROCEDURE",
            },
            "reasoning": (
                "Emergency rooms need oxygen, suction, and monitoring for resuscitation. "
                "Multi-patient bays are common in ER."
            ),
        }

    if unit_type in {"OT", "PACU"}:
        return {
            "defaults": {
                "hasOxygen": True,
                "hasSuction": True,
                "hasMonitor": True,
                "hasVentilator": True,
                "maxOccupancy": 1,
                "roomType": "PROCEDURE",
            },
            "reasoning": "Operating theatres and recovery areas require full life support equipment.",
        }

    if unit_type in WARD_TYPES:
        return {
            "defaults": {
                "hasCallButton": True,
                "hasAttachedBathroom": True,
                "maxOccupancy": 4,
                "roomType": "PATIENT_ROOM",
            },
            "reasoning": "General ward rooms typically have 4-6 beds with nurse call and attached bathroom.",
        }

    if unit_type in OPD_TYPES:
        return {
            "defaults": {
                "hasAC": True,
                "maxOccupancy": 1,
                "roomType": "CONSULTATION",
            },
            "reasoning": "OPD consultation rooms are single-doctor with climate control.",
        }

    return {
        "defaults": {"maxOccupancy": 1},
        "reasoning": "Default single-occupancy room.",
    }


def _resource_defaults(unit_type: str, ctx: dict[str, Any]) -> dict[str, Any]:
    if unit_type in ICU_TYPES:
        return {
            "defaults": {
                "resourceType": "ICU_BED",
                "hasOxygenSupply": True,
                "hasSuction": True,
                "hasMonitor": True,
                "hasVentilatorSupport": True,
            },
            "reasoning": "ICU beds require integrated life support per NABH standards.",
        }

    if unit_type in WARD_TYPES:
        return {
            "defaults": {
                "resourceType": "GENERAL_BED",
            },
            "reasoning": "Standard general beds for ward units.",
        }

    if unit_type in OPD_TYPES:
        return {
            "defaults": {
                "resourceType": "CONSULTATION_SLOT",
                "isSchedulable": True,
                "slotDurationMinutes": 15,
            },
            "reasoning": "OPD resources are schedulable consultation slots.",
        }

    return {"defaults": {}, "reasoning": "No specific defaults for this unit type."}


def _unit_defaults(ctx: dict[str, Any]) -> dict[str, Any]:
    return {
        "defaults": {
            "usesRooms": True,
            "isActive": True,
        },
        "reasoning": "Most units use room-based organization.",
    }


def _specialty_defaults(ctx: dict[str, Any]) -> dict[str, Any]:
    return {
        "defaults": {
            "kind": "SPECIALTY",
            "isActive": True,
        },
        "reasoning": "Default to standard specialty type. Change to SUPER_SPECIALTY for subspecialties like Cardiothoracic Surgery.",
    }


def _department_defaults(ctx: dict[str, Any]) -> dict[str, Any]:
    name = (ctx.get("name") or "").lower()

    # Infer facility type from name
    if any(kw in name for kw in ["emergency", "icu", "ot", "surgery", "cardiology", "orthopedic", "radiology", "pathology"]):
        facility_type = "CLINICAL"
    elif any(kw in name for kw in ["billing", "finance", "admin", "hr", "it", "procurement"]):
        facility_type = "SUPPORT"
    elif any(kw in name for kw in ["housekeeping", "laundry", "kitchen", "maintenance", "security"]):
        facility_type = "SERVICE"
    else:
        facility_type = "CLINICAL"

    return {
        "defaults": {
            "facilityType": facility_type,
            "isActive": True,
        },
        "reasoning": f"Suggested facility type '{facility_type}' based on department name pattern.",
    }


def _unit_type_defaults(ctx: dict[str, Any]) -> dict[str, Any]:
    category = (ctx.get("category") or "").upper()

    if category == "CRITICAL_CARE":
        return {
            "defaults": {
                "usesRoomsDefault": True,
                "bedBasedDefault": True,
                "schedulableByDefault": False,
            },
            "reasoning": "Critical care units are room-based and bed-based. Typically not schedulable.",
        }
    if category == "OUTPATIENT":
        return {
            "defaults": {
                "usesRoomsDefault": True,
                "bedBasedDefault": False,
                "schedulableByDefault": True,
            },
            "reasoning": "Outpatient units use consultation rooms and are schedulable for appointments.",
        }
    if category == "PROCEDURE":
        return {
            "defaults": {
                "usesRoomsDefault": True,
                "bedBasedDefault": False,
                "schedulableByDefault": True,
            },
            "reasoning": "Procedure units need operating/procedure rooms and are typically schedulable.",
        }
    if category == "INPATIENT":
        return {
            "defaults": {
                "usesRoomsDefault": True,
                "bedBasedDefault": True,
                "schedulableByDefault": False,
            },
            "reasoning": "Inpatient units are room and bed-based. Admission-driven, not schedulable.",
        }

    return {
        "defaults": {
            "usesRoomsDefault": True,
            "isActive": True,
        },
        "reasoning": "Default: uses rooms. Adjust based on unit category.",
    }


# ── Pharmacy Store ────────────────────────────────────────────────────────


def _pharmacy_store_defaults(ctx: dict[str, Any]) -> dict[str, Any]:
    store_type = (ctx.get("storeType") or "").upper()

    if store_type == "MAIN":
        return {
            "defaults": {
                "canDispense": True,
                "canIndent": True,
                "canReceiveStock": True,
                "canReturnVendor": True,
            },
            "reasoning": (
                "Main pharmacy store handles dispensing, procurement, and vendor returns. "
                "All capabilities enabled by default."
            ),
        }

    if store_type == "EMERGENCY":
        return {
            "defaults": {
                "is24x7": True,
                "canDispense": True,
                "canIndent": True,
                "canReceiveStock": False,
                "autoIndent": True,
            },
            "reasoning": (
                "Emergency pharmacy operates 24x7 with dispensing. "
                "Auto-indent from main store recommended for continuous supply."
            ),
        }

    if store_type == "NARCOTICS_VAULT":
        return {
            "defaults": {
                "canDispense": False,
                "canIndent": False,
                "canReceiveStock": True,
                "is24x7": False,
            },
            "reasoning": (
                "Narcotics vault stores controlled substances per NDPS Act. "
                "Stock is received and dispensed only via indent from authorized stores."
            ),
        }

    if store_type in ("OPD", "SATELLITE"):
        return {
            "defaults": {
                "canDispense": True,
                "canIndent": True,
                "canReceiveStock": False,
            },
            "reasoning": (
                "Satellite/OPD stores dispense to patients and indent from main store. "
                "Do not directly receive vendor stock."
            ),
        }

    if store_type == "RETURN_STORE":
        return {
            "defaults": {
                "canDispense": False,
                "canIndent": False,
                "canReceiveStock": True,
                "canReturnVendor": True,
            },
            "reasoning": "Return store collects expired/damaged drugs for vendor returns.",
        }

    return {
        "defaults": {
            "canDispense": True,
            "canIndent": True,
        },
        "reasoning": "Default store with dispensing and indent capabilities.",
    }


# ── Drug ──────────────────────────────────────────────────────────────────


def _drug_defaults(ctx: dict[str, Any]) -> dict[str, Any]:
    schedule = (ctx.get("scheduleClass") or "").upper()
    category = (ctx.get("category") or "").upper()

    defaults: dict[str, Any] = {
        "formularyStatus": "NON_FORMULARY",
        "status": "ACTIVE",
    }
    reasoning_parts: list[str] = []

    # Schedule-based flags
    if schedule == "X":
        defaults.update({
            "isNarcotic": True,
            "isControlled": True,
            "isPsychotropic": False,
        })
        reasoning_parts.append(
            "Schedule X: marked as narcotic and controlled per NDPS Act."
        )
    elif schedule == "H1":
        defaults.update({
            "isControlled": True,
            "isNarcotic": False,
        })
        reasoning_parts.append(
            "Schedule H1: controlled drug requiring special prescription."
        )
    elif schedule == "H":
        defaults.update({
            "isControlled": False,
            "isNarcotic": False,
        })
        reasoning_parts.append("Schedule H: prescription-only drug.")

    # Category-based defaults
    if category == "ANTIBIOTIC":
        defaults["isAntibiotic"] = True
        reasoning_parts.append("Antibiotic category: flagged for antibiotic stewardship tracking.")

    if not reasoning_parts:
        reasoning_parts.append("Standard drug defaults applied.")

    return {
        "defaults": defaults,
        "reasoning": " ".join(reasoning_parts),
    }


# ── Inventory Config ─────────────────────────────────────────────────────


def _inventory_config_defaults(ctx: dict[str, Any]) -> dict[str, Any]:
    """Heuristic stock levels based on hospital bed count and drug category."""
    bed_count = int(ctx.get("bedCount") or 0)
    schedule = (ctx.get("scheduleClass") or "").upper()
    is_narcotic = ctx.get("isNarcotic", False)
    is_high_alert = ctx.get("isHighAlert", False)

    if bed_count <= 0:
        bed_count = 100  # Default assumption

    # Base consumption = beds * daily_factor
    # General drugs: ~0.5 units/bed/day; narcotics: ~0.05; high-alert: ~0.1
    if is_narcotic:
        daily_factor = 0.05
    elif is_high_alert:
        daily_factor = 0.1
    else:
        daily_factor = 0.5

    daily_consumption = max(1, round(bed_count * daily_factor))
    lead_time_days = 3  # Average procurement lead time

    minimum_stock = daily_consumption * lead_time_days
    reorder_level = daily_consumption * (lead_time_days + 2)
    reorder_quantity = daily_consumption * 7  # 1-week order
    safety_stock = daily_consumption * 2
    maximum_stock = daily_consumption * 30  # 1-month max

    return {
        "defaults": {
            "minimumStock": minimum_stock,
            "maximumStock": maximum_stock,
            "reorderLevel": reorder_level,
            "reorderQuantity": reorder_quantity,
            "safetyStock": safety_stock,
        },
        "reasoning": (
            f"Based on {bed_count} beds, estimated daily consumption of {daily_consumption} unit(s). "
            f"Min stock covers {lead_time_days}-day lead time, reorder at {lead_time_days + 2} days, "
            f"order quantity for 7 days, max stock for 30 days."
        ),
    }


# ── Formulary Item ───────────────────────────────────────────────────────


def _formulary_item_defaults(ctx: dict[str, Any]) -> dict[str, Any]:
    """Suggest formulary tier based on schedule class and cost."""
    schedule = (ctx.get("scheduleClass") or "").upper()
    mrp = float(ctx.get("mrp") or 0)
    is_narcotic = ctx.get("isNarcotic", False)
    is_high_alert = ctx.get("isHighAlert", False)

    if is_narcotic or schedule == "X":
        tier = "RESTRICTED"
        reasoning = "Narcotic/Schedule X drugs are restricted tier per policy."
    elif is_high_alert:
        tier = "RESTRICTED"
        reasoning = "High-alert drugs assigned restricted tier for safety controls."
    elif mrp > 5000:
        tier = "RESTRICTED"
        reasoning = f"High-cost drug (MRP ₹{mrp:.0f}) placed in restricted tier for utilization review."
    elif mrp > 500:
        tier = "APPROVED"
        reasoning = "Standard-cost drug placed in approved tier."
    else:
        tier = "PREFERRED"
        reasoning = "Low-cost drug placed in preferred tier for first-line use."

    return {
        "defaults": {
            "tier": tier,
        },
        "reasoning": reasoning,
    }
