"""Page-Level Insights Engine — lightweight, per-page contextual tips.

Returns 0-5 targeted insights for a specific infrastructure page,
derived from the existing BranchContext data. No extra DB queries needed.
"""

from __future__ import annotations

import time
from typing import Any

from src.collectors.models import BranchContext
from .models import PageInsight, PageInsightsResult

ICU_TYPES = {"ICU", "HDU", "CCU", "NICU", "PICU", "SICU", "MICU"}


def get_page_insights(module: str, ctx: BranchContext) -> PageInsightsResult:
    """Generate module-specific insights from branch context."""
    insights: list[PageInsight] = []

    if module == "branches":
        insights = _branches_insights(ctx)
    elif module == "locations":
        insights = _locations_insights(ctx)
    elif module == "specialties":
        insights = _specialties_insights(ctx)
    elif module == "departments":
        insights = _departments_insights(ctx)
    elif module == "unit-types":
        insights = _unit_types_insights(ctx)
    elif module == "units":
        insights = _units_insights(ctx)
    elif module == "rooms":
        insights = _rooms_insights(ctx)
    elif module == "resources":
        insights = _resources_insights(ctx)
    elif module == "pharmacy":
        insights = _pharmacy_overview_insights(ctx)
    elif module == "pharmacy-stores":
        insights = _pharmacy_stores_insights(ctx)
    elif module == "pharmacy-drugs":
        insights = _pharmacy_drugs_insights(ctx)
    elif module == "pharmacy-formulary":
        insights = _pharmacy_formulary_insights(ctx)
    elif module == "pharmacy-suppliers":
        insights = _pharmacy_suppliers_insights(ctx)
    elif module == "pharmacy-inventory":
        insights = _pharmacy_inventory_insights(ctx)

    return PageInsightsResult(
        module=module,
        insights=insights[:5],  # cap at 5
        generatedAt=time.time(),
    )


# ── Branches ────────────────────────────────────────────────────────────


def _branches_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    b = ctx.branch

    # Missing legal entity name
    if not b.legalEntityName:
        insights.append(PageInsight(
            id="branch-no-legal",
            level="critical",
            message="Legal entity name is not set. This is required for compliance and billing.",
            actionHint="Edit branch details",
        ))

    # Missing address fields
    missing_addr: list[str] = []
    if not b.address:
        missing_addr.append("address")
    if not b.city:
        missing_addr.append("city")
    if not b.state:
        missing_addr.append("state")
    if not b.pinCode:
        missing_addr.append("pin code")
    if missing_addr:
        insights.append(PageInsight(
            id="branch-addr-incomplete",
            level="warning",
            message=f"Branch address is incomplete — missing {', '.join(missing_addr)}.",
            actionHint="Complete branch address",
        ))

    # Missing regulatory IDs
    missing_reg: list[str] = []
    if not b.gstNumber:
        missing_reg.append("GST")
    if not b.panNumber:
        missing_reg.append("PAN")
    if not b.clinicalEstRegNumber:
        missing_reg.append("Clinical Establishment Registration")
    if missing_reg:
        insights.append(PageInsight(
            id="branch-no-reg",
            level="warning",
            message=f"Missing regulatory numbers: {', '.join(missing_reg)}.",
            actionHint="Add regulatory details",
            entityCount=len(missing_reg),
        ))

    # Missing contact info
    if not b.contactPhone1 and not b.contactEmail:
        insights.append(PageInsight(
            id="branch-no-contact",
            level="warning",
            message="No contact phone or email set for this branch.",
            actionHint="Add contact information",
        ))

    # No bed count
    if not b.bedCount or b.bedCount == 0:
        insights.append(PageInsight(
            id="branch-no-beds",
            level="info",
            message="Bed count is not configured. This is used for NABH tier calculations.",
            actionHint="Set bed count",
        ))

    return insights


# ── Locations ───────────────────────────────────────────────────────────


def _locations_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    loc = ctx.location

    if loc.totalNodes == 0:
        insights.append(PageInsight(
            id="loc-empty",
            level="info",
            message="No location hierarchy configured. Create campuses, buildings, and floors to map physical spaces.",
            actionHint="Create location nodes",
        ))
        return insights

    # No buildings
    if loc.byKind.get("BUILDING", 0) == 0:
        insights.append(PageInsight(
            id="loc-no-buildings",
            level="warning",
            message="No buildings defined in the location tree. Buildings organize floors and zones.",
            actionHint="Add buildings",
        ))

    # No floors
    if loc.byKind.get("FLOOR", 0) == 0:
        insights.append(PageInsight(
            id="loc-no-floors",
            level="info",
            message="No floors defined yet. Floors help assign units and rooms to physical locations.",
            actionHint="Add floors under buildings",
        ))

    # Missing wheelchair access across all nodes
    if not loc.hasWheelchairAccess:
        insights.append(PageInsight(
            id="loc-no-wheelchair",
            level="info",
            message="No location nodes have wheelchair access marked. Consider updating for accessibility compliance.",
            actionHint="Mark wheelchair-accessible locations",
        ))

    # Missing fire zone assignment
    if not loc.hasFireZones:
        insights.append(PageInsight(
            id="loc-no-firezones",
            level="info",
            message="No fire zone assignments in the location tree. Fire zones are recommended for safety compliance.",
            actionHint="Assign fire zones",
        ))

    # Nodes pending revision
    if loc.nodesWithoutRevision > 0:
        insights.append(PageInsight(
            id="loc-pending-revision",
            level="warning",
            message=f"{loc.nodesWithoutRevision} location {'node needs' if loc.nodesWithoutRevision == 1 else 'nodes need'} revision.",
            actionHint="Review location nodes",
            entityCount=loc.nodesWithoutRevision,
        ))

    return insights


# ── Specialties ──────────────────────────────────────────────────────────


def _specialties_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    specs = ctx.specialties

    if specs.total == 0:
        insights.append(PageInsight(
            id="spec-empty",
            level="info",
            message="No specialties configured yet. Add your hospital's clinical specialties to enable department tagging.",
            actionHint="Create specialties",
        ))
        return insights

    # Specialties with no departments linked
    unlinked = [s for s in specs.specialties if s.isActive and s.departmentCount == 0]
    if unlinked:
        insights.append(PageInsight(
            id="spec-no-dept",
            level="warning",
            message=f"{len(unlinked)} active {'specialty has' if len(unlinked) == 1 else 'specialties have'} no departments linked.",
            actionHint="Link specialties to departments",
            entityCount=len(unlinked),
        ))

    # All specialties inactive
    if specs.total > 0 and specs.active == 0:
        insights.append(PageInsight(
            id="spec-all-inactive",
            level="critical",
            message="All specialties are inactive. Departments need at least one active specialty.",
            actionHint="Activate specialties",
        ))

    # No super-specialties
    if specs.total > 0 and specs.byKind.get("SUPER_SPECIALTY", 0) == 0:
        insights.append(PageInsight(
            id="spec-no-super",
            level="info",
            message="No super-specialties defined. Consider adding if your hospital offers super-specialty services.",
        ))

    # Low specialty count
    if 0 < specs.total < 3:
        insights.append(PageInsight(
            id="spec-low-count",
            level="info",
            message=f"Only {specs.total} {'specialty' if specs.total == 1 else 'specialties'} configured. Most hospitals have 5-15 specialties.",
        ))

    return insights


# ── Departments ──────────────────────────────────────────────────────────


def _departments_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    depts = ctx.departments

    if depts.total == 0:
        insights.append(PageInsight(
            id="dept-empty",
            level="info",
            message="No departments configured yet. Create departments to organize clinical and support services.",
            actionHint="Create departments",
        ))
        return insights

    # Departments without head
    no_head_count = depts.total - depts.withHead
    if no_head_count > 0:
        insights.append(PageInsight(
            id="dept-no-head",
            level="warning",
            message=f"{no_head_count} {'department has' if no_head_count == 1 else 'departments have'} no head assigned.",
            actionHint="Assign department heads",
            entityCount=no_head_count,
        ))

    # Departments with no units
    dept_ids_with_units = {u.departmentId for u in ctx.units.units if u.departmentId}
    depts_without_units = [d for d in depts.departments if d.id not in dept_ids_with_units]
    if depts_without_units:
        insights.append(PageInsight(
            id="dept-no-units",
            level="info",
            message=f"{len(depts_without_units)} {'department has' if len(depts_without_units) == 1 else 'departments have'} no units created yet.",
            actionHint="Create units for departments",
            entityCount=len(depts_without_units),
        ))

    # Clinical departments without staff
    clinical_no_staff = [
        d for d in depts.departments
        if d.facilityType == "CLINICAL" and d.staffCount == 0
    ]
    if clinical_no_staff:
        insights.append(PageInsight(
            id="dept-clinical-no-staff",
            level="warning",
            message=f"{len(clinical_no_staff)} clinical {'department has' if len(clinical_no_staff) == 1 else 'departments have'} no staff assigned.",
            actionHint="Assign staff to clinical departments",
            entityCount=len(clinical_no_staff),
        ))

    return insights


# ── Unit Types ───────────────────────────────────────────────────────────


def _unit_types_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []

    types_info = ctx.units.byType  # dict[typeCode, {count, ...}]

    if not types_info:
        insights.append(PageInsight(
            id="ut-empty",
            level="info",
            message="No unit types enabled yet. Enable unit types from the catalog to start creating units.",
            actionHint="Enable unit types",
        ))
        return insights

    # Unit types with no actual units
    unused_types = [code for code, info in types_info.items() if info.get("count", 0) == 0]
    if unused_types:
        insights.append(PageInsight(
            id="ut-no-units",
            level="info",
            message=f"{len(unused_types)} enabled unit {'type has' if len(unused_types) == 1 else 'types have'} no units created.",
            actionHint="Create units or disable unused types",
            entityCount=len(unused_types),
        ))

    # No critical care unit types enabled
    unit_type_codes_in_use = {u.typeCode for u in ctx.units.units}
    has_critical = any(
        code.upper() in ICU_TYPES
        for code in unit_type_codes_in_use
    )
    bed_count = ctx.branch.bedCount or 0
    if bed_count > 50 and not has_critical:
        insights.append(PageInsight(
            id="ut-no-icu",
            level="warning",
            message="Hospital has 50+ beds but no ICU/critical care unit types are in use.",
            actionHint="Enable ICU unit type and create ICU units",
        ))

    # Summary when everything looks good
    if not insights:
        total_types = len(types_info)
        total_units = sum(info.get("count", 0) for info in types_info.values())
        insights.append(PageInsight(
            id="ut-summary",
            level="info",
            message=f"{total_types} unit {'type' if total_types == 1 else 'types'} enabled with {total_units} total {'unit' if total_units == 1 else 'units'} across all types.",
            entityCount=total_types,
        ))

    return insights


# ── Units ────────────────────────────────────────────────────────────────


def _units_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    units = ctx.units.units

    if not units:
        insights.append(PageInsight(
            id="unit-empty",
            level="info",
            message="No units configured yet. Units organize rooms, beds, and resources under departments.",
            actionHint="Create units",
        ))
        return insights

    # Units with 0 rooms
    needs_rooms = [u for u in units if u.isActive and len(u.rooms) == 0]
    if needs_rooms:
        insights.append(PageInsight(
            id="unit-no-rooms",
            level="warning",
            message=f"{len(needs_rooms)} active {'unit has' if len(needs_rooms) == 1 else 'units have'} no rooms configured.",
            actionHint="Add rooms to units",
            entityCount=len(needs_rooms),
        ))

    # Units with no resources
    no_resources = [u for u in units if u.isActive and u.resources.total == 0]
    if no_resources:
        insights.append(PageInsight(
            id="unit-no-resources",
            level="info",
            message=f"{len(no_resources)} active {'unit has' if len(no_resources) == 1 else 'units have'} no resources (beds/equipment).",
            actionHint="Add resources to units",
            entityCount=len(no_resources),
        ))

    # Units with no location
    no_location = [u for u in units if u.isActive and not u.locationNodeId]
    if no_location:
        insights.append(PageInsight(
            id="unit-no-location",
            level="info",
            message=f"{len(no_location)} {'unit is' if len(no_location) == 1 else 'units are'} not linked to a physical location.",
            actionHint="Assign locations to units",
            entityCount=len(no_location),
        ))

    # Summary when everything looks good
    if not insights:
        active = [u for u in units if u.isActive]
        total_rooms = sum(len(u.rooms) for u in active)
        total_res = sum(u.resources.total for u in active)
        insights.append(PageInsight(
            id="unit-summary",
            level="info",
            message=f"{len(active)} active {'unit' if len(active) == 1 else 'units'} with {total_rooms} rooms and {total_res} resources configured.",
            entityCount=len(active),
        ))

    return insights


# ── Rooms ────────────────────────────────────────────────────────────────


def _rooms_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []

    total_rooms = sum(len(u.rooms) for u in ctx.units.units)

    if total_rooms == 0:
        if ctx.units.units:
            insights.append(PageInsight(
                id="rooms-empty",
                level="info",
                message="No rooms configured yet. Add rooms to your units to define patient areas.",
                actionHint="Add rooms to units",
            ))
        return insights

    # ICU rooms without required amenities
    for unit in ctx.units.units:
        if unit.typeCode.upper() in ICU_TYPES:
            for room in unit.rooms:
                if room.isActive and (not room.hasOxygen or not room.hasSuction):
                    missing = "oxygen" if not room.hasOxygen else "suction"
                    insights.append(PageInsight(
                        id=f"room-icu-amenity-{room.id[:8]}",
                        level="critical",
                        message=f"Room {room.code} in {unit.code} (ICU) is missing {missing} — NABH requirement.",
                        actionHint="Update room amenities",
                    ))
                    if len(insights) >= 3:
                        break
        if len(insights) >= 3:
            break

    # Rooms in units with 0 resources
    rooms_no_resources = 0
    for unit in ctx.units.units:
        if unit.isActive and len(unit.rooms) > 0 and unit.resources.total == 0:
            rooms_no_resources += len(unit.rooms)

    if rooms_no_resources > 0:
        insights.append(PageInsight(
            id="rooms-unit-no-resources",
            level="warning",
            message=f"{rooms_no_resources} rooms are in units with no resources (beds/equipment).",
            actionHint="Add resources to rooms",
            entityCount=rooms_no_resources,
        ))

    # Summary when everything looks good
    if not insights:
        insights.append(PageInsight(
            id="rooms-summary",
            level="info",
            message=f"{total_rooms} rooms configured across {len(ctx.units.units)} units. All ICU rooms have required amenities.",
            entityCount=total_rooms,
        ))

    return insights


# ── Resources ────────────────────────────────────────────────────────────


def _resources_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []

    # Aggregate resource stats
    total_blocked = 0
    total_reserved = 0
    total_resources = 0
    resource_by_unit: dict[str, int] = {}

    for unit in ctx.units.units:
        res = unit.resources
        total_resources += res.total
        resource_by_unit[unit.code] = res.total
        total_blocked += res.byState.get("BLOCKED", 0)
        total_reserved += res.byState.get("RESERVED", 0)

    if total_resources == 0:
        if ctx.units.units:
            insights.append(PageInsight(
                id="res-empty",
                level="info",
                message="No resources configured yet. Add beds, equipment, and consultation slots to your units.",
                actionHint="Add resources to units",
            ))
        return insights

    if total_blocked > 0:
        insights.append(PageInsight(
            id="res-blocked",
            level="warning",
            message=f"{total_blocked} {'resource is' if total_blocked == 1 else 'resources are'} currently blocked.",
            actionHint="Review blocked resources",
            entityCount=total_blocked,
        ))

    if total_reserved > 0:
        insights.append(PageInsight(
            id="res-reserved",
            level="info",
            message=f"{total_reserved} {'resource is' if total_reserved == 1 else 'resources are'} currently reserved.",
            entityCount=total_reserved,
        ))

    # Imbalance: units with 0 resources while others have many
    if resource_by_unit:
        units_with_zero = [code for code, count in resource_by_unit.items() if count == 0]
        units_with_resources = [code for code, count in resource_by_unit.items() if count > 0]
        if units_with_zero and units_with_resources:
            insights.append(PageInsight(
                id="res-imbalance",
                level="info",
                message=f"{len(units_with_zero)} {'unit has' if len(units_with_zero) == 1 else 'units have'} no resources while {len(units_with_resources)} have resources configured.",
                actionHint="Add resources to empty units",
                entityCount=len(units_with_zero),
            ))

    # Summary when everything looks good
    if not insights:
        beds = sum(u.resources.beds for u in ctx.units.units)
        insights.append(PageInsight(
            id="res-summary",
            level="info",
            message=f"{total_resources} resources configured across {len(resource_by_unit)} units ({beds} beds).",
            entityCount=total_resources,
        ))

    return insights


# ── Pharmacy Overview ──────────────────────────────────────────────────


def _pharmacy_overview_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    ph = ctx.pharmacy

    if ph.totalStores == 0 and ph.totalDrugs == 0:
        insights.append(PageInsight(
            id="ph-not-started",
            level="info",
            message="Pharmacy module is not set up yet. Start by creating a Main pharmacy store, then import your drug master.",
            actionHint="Create pharmacy store",
        ))
        return insights

    # No main store
    main_stores = [s for s in ph.stores if s.storeType == "MAIN" and s.status == "ACTIVE"]
    if not main_stores:
        insights.append(PageInsight(
            id="ph-no-main",
            level="critical",
            message="No ACTIVE main pharmacy store. This is required for dispensing and procurement.",
            actionHint="Create or activate main store",
        ))

    # Low drug count
    if 0 < ph.activeDrugs < 100:
        insights.append(PageInsight(
            id="ph-low-drugs",
            level="warning",
            message=f"Only {ph.activeDrugs} active drugs in the master. At least 100 are recommended for go-live.",
            actionHint="Import drugs via bulk import",
            entityCount=ph.activeDrugs,
        ))

    # No formulary
    if not ph.hasFormulary:
        insights.append(PageInsight(
            id="ph-no-formulary",
            level="warning",
            message="No formulary published yet. Formularies control which drugs are approved for prescription.",
            actionHint="Create and publish a formulary",
        ))

    # Narcotics without vault
    if ph.narcoticCount > 0:
        vault_stores = [s for s in ph.stores if s.storeType == "NARCOTICS_VAULT"]
        if not vault_stores:
            insights.append(PageInsight(
                id="ph-narcotic-no-vault",
                level="warning",
                message=f"{ph.narcoticCount} narcotic drug(s) in master but no narcotics vault store configured.",
                actionHint="Create narcotics vault store",
                entityCount=ph.narcoticCount,
            ))

    # Good summary
    if not insights:
        insights.append(PageInsight(
            id="ph-summary",
            level="info",
            message=f"Pharmacy: {ph.activeStores} store(s), {ph.activeDrugs} drugs, {ph.supplierCount} supplier(s). {'Formulary published.' if ph.hasFormulary else ''}",
        ))

    return insights


# ── Pharmacy Stores ───────────────────────────────────────────────────


def _pharmacy_stores_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    ph = ctx.pharmacy

    if ph.totalStores == 0:
        insights.append(PageInsight(
            id="phs-empty",
            level="info",
            message="No pharmacy stores configured. Create a Main store to begin setting up your pharmacy.",
            actionHint="Create pharmacy store",
        ))
        return insights

    # Active stores missing license
    active_stores = [s for s in ph.stores if s.status == "ACTIVE"]
    no_license = [s for s in active_stores if not s.drugLicenseNumber]
    if no_license:
        insights.append(PageInsight(
            id="phs-no-license",
            level="critical",
            message=f"{len(no_license)} ACTIVE store(s) missing drug license number. Required by law.",
            actionHint="Add drug license numbers",
            entityCount=len(no_license),
        ))

    # Active stores missing pharmacist
    no_pharmacist = [s for s in active_stores if not s.pharmacistInChargeId]
    if no_pharmacist:
        insights.append(PageInsight(
            id="phs-no-pharmacist",
            level="critical",
            message=f"{len(no_pharmacist)} ACTIVE store(s) missing pharmacist-in-charge. Required for drug dispensing.",
            actionHint="Assign pharmacists",
            entityCount=len(no_pharmacist),
        ))

    # License expiry check
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    expiring = [
        s for s in active_stores
        if s.drugLicenseExpiry and s.drugLicenseExpiry <= now + timedelta(days=90)
    ]
    if expiring:
        insights.append(PageInsight(
            id="phs-license-expiry",
            level="warning",
            message=f"{len(expiring)} store(s) with drug license expiring within 90 days.",
            actionHint="Renew drug licenses",
            entityCount=len(expiring),
        ))

    # No dispensing store
    dispensing = [s for s in active_stores if s.canDispense]
    if active_stores and not dispensing:
        insights.append(PageInsight(
            id="phs-no-dispensing",
            level="warning",
            message="No ACTIVE store has dispensing enabled. At least one is required for patient prescriptions.",
            actionHint="Enable dispensing on a store",
        ))

    return insights


# ── Pharmacy Drugs ────────────────────────────────────────────────────


def _pharmacy_drugs_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    ph = ctx.pharmacy

    if ph.totalDrugs == 0:
        insights.append(PageInsight(
            id="phd-empty",
            level="info",
            message="Drug master is empty. Import drugs via bulk import or add them individually.",
            actionHint="Import drugs",
        ))
        return insights

    # High-alert drugs count
    if ph.highAlertCount > 0:
        insights.append(PageInsight(
            id="phd-high-alert",
            level="info",
            message=f"{ph.highAlertCount} high-alert drug(s) in master. These require special storage and dispensing protocols.",
            entityCount=ph.highAlertCount,
        ))

    # LASA drugs
    if ph.lasaCount > 0:
        insights.append(PageInsight(
            id="phd-lasa",
            level="info",
            message=f"{ph.lasaCount} LASA (Look-Alike Sound-Alike) drug(s) flagged. Ensure Tall-Man lettering on labels.",
            entityCount=ph.lasaCount,
        ))
    elif ph.totalDrugs > 50:
        insights.append(PageInsight(
            id="phd-no-lasa",
            level="warning",
            message="No drugs flagged as LASA. With 50+ drugs, LASA pairs likely exist. Run LASA detection.",
            actionHint="Review LASA pairs",
        ))

    # No interactions configured
    if ph.interactionCount == 0 and ph.totalDrugs > 20:
        insights.append(PageInsight(
            id="phd-no-interactions",
            level="warning",
            message="No drug interactions configured. Interaction checking is critical for patient safety.",
            actionHint="Import drug interaction database",
        ))

    # Category distribution insight
    if ph.byCategory:
        top_cat = max(ph.byCategory, key=ph.byCategory.get)  # type: ignore
        insights.append(PageInsight(
            id="phd-category",
            level="info",
            message=f"Drug distribution: {len(ph.byCategory)} categories. Largest: {top_cat} ({ph.byCategory[top_cat]} drugs).",
            entityCount=ph.totalDrugs,
        ))

    return insights


# ── Pharmacy Formulary ───────────────────────────────────────────────


def _pharmacy_formulary_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    ph = ctx.pharmacy

    if not ph.hasFormulary:
        insights.append(PageInsight(
            id="phf-none",
            level="warning",
            message="No formulary created yet. A published formulary defines approved drugs for prescribing.",
            actionHint="Create a formulary",
        ))
        return insights

    if ph.formularyStatus == "DRAFT":
        insights.append(PageInsight(
            id="phf-draft",
            level="warning",
            message=f"Formulary v{ph.formularyVersion} is in DRAFT status. Publish it to make it active for prescribers.",
            actionHint="Publish formulary",
        ))

    if ph.formularyStatus == "PUBLISHED":
        insights.append(PageInsight(
            id="phf-published",
            level="info",
            message=f"Formulary v{ph.formularyVersion} is published and active.",
        ))

    # Compare drug count to formulary expectation
    if ph.totalDrugs > 0 and ph.activeDrugs > 0:
        # Rough check: if < 50% of active drugs might be in formulary
        insights.append(PageInsight(
            id="phf-coverage",
            level="info",
            message=f"Drug master has {ph.activeDrugs} active drugs. Ensure formulary covers essential and commonly used drugs.",
            actionHint="Review formulary items",
            entityCount=ph.activeDrugs,
        ))

    return insights


# ── Pharmacy Suppliers ───────────────────────────────────────────────


def _pharmacy_suppliers_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    ph = ctx.pharmacy

    if ph.supplierCount == 0:
        if ph.totalDrugs > 0:
            insights.append(PageInsight(
                id="phsup-none",
                level="warning",
                message="No active suppliers configured. Suppliers are needed for procurement and indent workflows.",
                actionHint="Add suppliers",
            ))
        else:
            insights.append(PageInsight(
                id="phsup-empty",
                level="info",
                message="No suppliers configured yet. Add suppliers after setting up your drug master.",
                actionHint="Add suppliers",
            ))
        return insights

    if ph.supplierCount == 1:
        insights.append(PageInsight(
            id="phsup-single",
            level="info",
            message="Only 1 supplier configured. Consider adding backup suppliers for supply chain resilience.",
            actionHint="Add more suppliers",
            entityCount=1,
        ))

    if ph.supplierCount >= 2:
        insights.append(PageInsight(
            id="phsup-ok",
            level="info",
            message=f"{ph.supplierCount} active supplier(s) configured.",
            entityCount=ph.supplierCount,
        ))

    return insights


# ── Pharmacy Inventory ───────────────────────────────────────────────


def _pharmacy_inventory_insights(ctx: BranchContext) -> list[PageInsight]:
    insights: list[PageInsight] = []
    ph = ctx.pharmacy

    if ph.inventoryConfigCount == 0:
        if ph.totalDrugs > 0 and ph.totalStores > 0:
            insights.append(PageInsight(
                id="phi-none",
                level="warning",
                message="No inventory levels configured. Set min/max/reorder levels to enable stock management.",
                actionHint="Configure inventory levels",
            ))
        else:
            insights.append(PageInsight(
                id="phi-prereq",
                level="info",
                message="Set up pharmacy stores and drug master before configuring inventory levels.",
            ))
        return insights

    # Check coverage
    if ph.activeDrugs > 0:
        coverage_pct = round(ph.inventoryConfigCount / ph.activeDrugs * 100)
        if coverage_pct < 50:
            insights.append(PageInsight(
                id="phi-low-coverage",
                level="warning",
                message=f"Only {coverage_pct}% of active drugs have inventory levels configured ({ph.inventoryConfigCount} of {ph.activeDrugs}).",
                actionHint="Configure remaining inventory levels",
                entityCount=ph.activeDrugs - ph.inventoryConfigCount,
            ))
        else:
            insights.append(PageInsight(
                id="phi-coverage",
                level="info",
                message=f"{coverage_pct}% of active drugs have inventory levels configured ({ph.inventoryConfigCount} of {ph.activeDrugs}).",
                entityCount=ph.inventoryConfigCount,
            ))

    return insights
