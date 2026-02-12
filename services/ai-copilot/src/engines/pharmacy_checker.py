"""Pharmacy Consistency Checker — 12 go-live checks for pharmacy module.

Mirrors the NestJS PharmacyGoLiveService checks in Python for the AI copilot
health-check endpoint. Uses the BranchContext.pharmacy snapshot instead of
direct DB queries.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from src.collectors.models import BranchContext, PharmacySummary
from .models import ConsistencyIssue

# ── Reference data ────────────────────────────────────────────────────────

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json(filename: str) -> Any:
    """Load a JSON data file, returning empty structure on failure."""
    try:
        with open(_DATA_DIR / filename, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _get_lasa_pairs() -> list[tuple[str, str]]:
    data = _load_json("lasa-pairs.json")
    return [(p["a"].lower(), p["b"].lower()) for p in data.get("pairs", [])]


def _get_specialty_drugs() -> dict[str, list[str]]:
    data = _load_json("specialty-drugs.json")
    return {k: [d.lower() for d in v] for k, v in data.get("specialties", {}).items()}


# ── Checker ───────────────────────────────────────────────────────────────


def run_pharmacy_checks(ctx: BranchContext) -> list[ConsistencyIssue]:
    """Run 12 pharmacy go-live consistency checks."""
    ph = ctx.pharmacy
    issues: list[ConsistencyIssue] = []

    if ph.totalStores == 0 and ph.totalDrugs == 0:
        # Pharmacy not configured at all — single INFO issue
        issues.append(ConsistencyIssue(
            id="PH-001",
            category="PHARMACY",
            severity="INFO",
            title="Pharmacy module not configured",
            details="No pharmacy stores or drugs have been set up for this branch.",
            fixHint="Navigate to Infrastructure → Pharmacy to begin setup.",
        ))
        return issues

    # ── PH-001: At least 1 pharmacy store configured ─────────────────
    if ph.totalStores == 0:
        issues.append(ConsistencyIssue(
            id="PH-001",
            category="PHARMACY",
            severity="BLOCKER",
            title="No pharmacy stores configured",
            details="At least one pharmacy store is required before go-live.",
            fixHint="Create a pharmacy store (MAIN type) under Infrastructure → Pharmacy → Stores.",
        ))

    # ── PH-002: Main store exists and is ACTIVE ──────────────────────
    main_stores = [s for s in ph.stores if s.storeType == "MAIN" and s.status == "ACTIVE"]
    if ph.totalStores > 0 and not main_stores:
        issues.append(ConsistencyIssue(
            id="PH-002",
            category="PHARMACY",
            severity="BLOCKER",
            title="No ACTIVE main pharmacy store",
            details="A store of type MAIN must be in ACTIVE status for dispensing.",
            fixHint="Set your main pharmacy store status to ACTIVE, or create one.",
        ))

    # ── PH-003: Every ACTIVE store has drug license ──────────────────
    active_stores = [s for s in ph.stores if s.status == "ACTIVE"]
    stores_no_license = [s for s in active_stores if not s.drugLicenseNumber]
    if stores_no_license:
        codes = ", ".join(s.storeCode for s in stores_no_license[:5])
        issues.append(ConsistencyIssue(
            id="PH-003",
            category="PHARMACY",
            severity="BLOCKER",
            title="ACTIVE store(s) missing drug license",
            details=f"{len(stores_no_license)} ACTIVE store(s) have no drug license number: {codes}.",
            fixHint="Add drug license numbers to all ACTIVE pharmacy stores.",
            count=len(stores_no_license),
        ))

    # ── PH-004: Every ACTIVE store has pharmacist-in-charge ──────────
    stores_no_pharmacist = [s for s in active_stores if not s.pharmacistInChargeId]
    if stores_no_pharmacist:
        codes = ", ".join(s.storeCode for s in stores_no_pharmacist[:5])
        issues.append(ConsistencyIssue(
            id="PH-004",
            category="PHARMACY",
            severity="BLOCKER",
            title="ACTIVE store(s) missing pharmacist-in-charge",
            details=f"{len(stores_no_pharmacist)} ACTIVE store(s) have no pharmacist assigned: {codes}.",
            fixHint="Assign a pharmacist-in-charge to all ACTIVE pharmacy stores.",
            count=len(stores_no_pharmacist),
        ))

    # ── PH-005: Drug master has >= 100 active drugs ──────────────────
    if ph.activeDrugs < 100:
        issues.append(ConsistencyIssue(
            id="PH-005",
            category="PHARMACY",
            severity="BLOCKER",
            title="Drug master has fewer than 100 active drugs",
            details=f"Only {ph.activeDrugs} active drug(s) found. At least 100 are required for go-live.",
            fixHint="Import drugs via bulk import or add them individually in Drug Master.",
            count=ph.activeDrugs,
        ))

    # ── PH-006: At least 1 dispensing store ──────────────────────────
    dispensing_stores = [s for s in active_stores if s.canDispense]
    if ph.totalStores > 0 and not dispensing_stores:
        issues.append(ConsistencyIssue(
            id="PH-006",
            category="PHARMACY",
            severity="BLOCKER",
            title="No dispensing-enabled store",
            details="At least one ACTIVE store must have canDispense=true for patient dispensing.",
            fixHint="Enable dispensing on your main pharmacy store.",
        ))

    # ── PH-007: Formulary published ──────────────────────────────────
    if not ph.hasFormulary or ph.formularyStatus != "PUBLISHED":
        issues.append(ConsistencyIssue(
            id="PH-007",
            category="PHARMACY",
            severity="WARNING",
            title="No published formulary",
            details="Publish a formulary to define which drugs are approved for use.",
            fixHint="Go to Formulary → publish the current draft version.",
        ))

    # ── PH-008: Drug interaction database linked ─────────────────────
    if ph.interactionCount == 0 and ph.totalDrugs > 0:
        issues.append(ConsistencyIssue(
            id="PH-008",
            category="PHARMACY",
            severity="WARNING",
            title="No drug interactions configured",
            details="Drug interaction checking cannot work without interaction data.",
            fixHint="Import a drug interaction database or add interactions manually.",
        ))

    # ── PH-009: Narcotics vault if Schedule X drugs exist ────────────
    narcotic_drugs = [d for d in ph.drugs if d.isNarcotic]
    vault_stores = [s for s in ph.stores if s.storeType == "NARCOTICS_VAULT"]
    if narcotic_drugs and not vault_stores:
        issues.append(ConsistencyIssue(
            id="PH-009",
            category="PHARMACY",
            severity="WARNING",
            title="Narcotic drugs without narcotics vault",
            details=f"{len(narcotic_drugs)} narcotic drug(s) found but no NARCOTICS_VAULT store configured.",
            fixHint="Create a pharmacy store of type NARCOTICS_VAULT for NDPS compliance.",
            count=len(narcotic_drugs),
        ))

    # ── PH-010: At least 1 supplier configured ──────────────────────
    if ph.supplierCount == 0 and ph.totalDrugs > 0:
        issues.append(ConsistencyIssue(
            id="PH-010",
            category="PHARMACY",
            severity="WARNING",
            title="No active suppliers configured",
            details="At least one supplier is needed for procurement and indent workflows.",
            fixHint="Add suppliers under Infrastructure → Pharmacy → Suppliers.",
        ))

    # ── PH-011: Drug license expiry within 90 days ───────────────────
    now = datetime.utcnow()
    ninety_days = now + timedelta(days=90)
    expiring_stores = [
        s for s in active_stores
        if s.drugLicenseExpiry and s.drugLicenseExpiry <= ninety_days
    ]
    if expiring_stores:
        codes = ", ".join(
            f"{s.storeCode} (exp {s.drugLicenseExpiry.strftime('%Y-%m-%d')})"
            for s in expiring_stores[:5]
        )
        issues.append(ConsistencyIssue(
            id="PH-011",
            category="PHARMACY",
            severity="WARNING",
            title="Drug license(s) expiring within 90 days",
            details=f"{len(expiring_stores)} store(s) with license expiring soon: {codes}.",
            fixHint="Renew drug licenses before expiry to maintain compliance.",
            count=len(expiring_stores),
        ))

    # ── PH-012: LASA pair gaps ───────────────────────────────────────
    _check_lasa_gaps(ph, issues)

    # ── PH-013: Missing specialty drugs ──────────────────────────────
    _check_specialty_drug_gaps(ctx, issues)

    return issues


def _check_lasa_gaps(ph: PharmacySummary, issues: list[ConsistencyIssue]) -> None:
    """Check if known LASA pairs exist in the drug master without isLasa flag."""
    lasa_pairs = _get_lasa_pairs()
    if not lasa_pairs:
        return

    drug_names = {d.genericName.lower() for d in ph.drugs}
    flagged_lasa = {d.genericName.lower() for d in ph.drugs if d.isLasa}

    unflagged_pairs: list[str] = []
    for a, b in lasa_pairs:
        if a in drug_names and b in drug_names:
            # Both drugs exist — check if at least one is flagged LASA
            if a not in flagged_lasa or b not in flagged_lasa:
                unflagged_pairs.append(f"{a}/{b}")

    if unflagged_pairs:
        sample = ", ".join(unflagged_pairs[:5])
        issues.append(ConsistencyIssue(
            id="PH-012",
            category="PHARMACY",
            severity="INFO",
            title="LASA pairs not flagged",
            details=f"{len(unflagged_pairs)} known LASA pair(s) found but not all flagged: {sample}.",
            fixHint="Mark both drugs in each LASA pair with isLasa=true in Drug Master.",
            count=len(unflagged_pairs),
        ))


def _check_specialty_drug_gaps(ctx: BranchContext, issues: list[ConsistencyIssue]) -> None:
    """Check if hospital specialties have their essential drugs in the master."""
    spec_drugs = _get_specialty_drugs()
    if not spec_drugs:
        return

    active_specialties = {
        s.code.upper() for s in ctx.specialties.specialties if s.isActive
    }
    drug_generics = {d.genericName.lower() for d in ctx.pharmacy.drugs if d.status == "ACTIVE"}

    missing_groups: list[str] = []
    for spec_code, expected_drugs in spec_drugs.items():
        if spec_code.upper() in active_specialties:
            missing = [d for d in expected_drugs if d not in drug_generics]
            if missing:
                missing_groups.append(
                    f"{spec_code}: {', '.join(missing[:3])}"
                    + (f" +{len(missing)-3} more" if len(missing) > 3 else "")
                )

    if missing_groups:
        sample = "; ".join(missing_groups[:3])
        issues.append(ConsistencyIssue(
            id="PH-013",
            category="PHARMACY",
            severity="WARNING",
            title="Missing drugs for configured specialties",
            details=f"Essential drugs missing for specialties: {sample}.",
            fixHint="Review specialty drug requirements and add missing drugs to Drug Master.",
            count=len(missing_groups),
        ))
