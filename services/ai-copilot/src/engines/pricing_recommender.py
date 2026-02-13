"""Pricing Recommender Engine — statistical pricing advice based on branch context."""

from __future__ import annotations

from pydantic import BaseModel, Field

from src.collectors.models import BranchContext


class PricingInsight(BaseModel):
    id: str
    level: str  # "info" | "warning" | "critical"
    message: str
    recommendation: str | None = None


class PricingRecommendation(BaseModel):
    insights: list[PricingInsight] = Field(default_factory=list)
    serviceCoveragePercent: float = 0.0
    avgPriceChangePercent: float | None = None


def recommend_pricing(ctx: BranchContext) -> PricingRecommendation:
    """Generate pricing recommendations based on branch service catalog data."""
    sc = ctx.serviceCatalog
    insights: list[PricingInsight] = []

    # Coverage analysis
    coverage = 0.0
    if sc.totalServiceItems > 0:
        coverage = (sc.withBasePrice / sc.totalServiceItems) * 100

    if sc.withoutBasePrice > 0:
        level = "critical" if sc.withoutBasePrice > 10 else "warning"
        insights.append(PricingInsight(
            id="PRICE_MISSING_BASE",
            level=level,
            message=f"{sc.withoutBasePrice} service(s) have no base price set",
            recommendation="Set base prices for all active service items to enable accurate billing",
        ))

    # Tariff plan coverage
    if sc.totalTariffPlans == 0:
        insights.append(PricingInsight(
            id="NO_TARIFF_PLANS",
            level="critical",
            message="No tariff plans configured",
            recommendation="Create at least one tariff plan and assign rates to services",
        ))
    elif sc.activeTariffPlans == 0:
        insights.append(PricingInsight(
            id="NO_ACTIVE_TARIFF",
            level="warning",
            message="No active tariff plans — all plans are inactive",
            recommendation="Activate at least one tariff plan for billing",
        ))

    # Tax code check
    if sc.totalTaxCodes == 0:
        insights.append(PricingInsight(
            id="NO_TAX_CODES",
            level="critical",
            message="No GST tax codes configured",
            recommendation="Configure tax codes (5%, 12%, 18%) for GST compliance",
        ))

    # Payer-contract coverage
    if sc.totalPayers > 0 and sc.totalContracts == 0:
        insights.append(PricingInsight(
            id="PAYERS_NO_CONTRACTS",
            level="warning",
            message=f"{sc.totalPayers} payer(s) configured but no contracts exist",
            recommendation="Create payer contracts to define negotiated rates",
        ))

    # Expired contracts
    if sc.expiredContracts > 0:
        insights.append(PricingInsight(
            id="EXPIRED_CONTRACTS",
            level="warning",
            message=f"{sc.expiredContracts} contract(s) have expired",
            recommendation="Review and renew expired contracts or mark them as terminated",
        ))

    # Cash payer check
    if not sc.hasCashPayer and sc.totalPayers > 0:
        insights.append(PricingInsight(
            id="NO_CASH_PAYER",
            level="warning",
            message="No CASH payer configured",
            recommendation="Add a CASH payer as the default self-pay option",
        ))

    # Pricing tiers
    if sc.totalPricingTiers == 0:
        insights.append(PricingInsight(
            id="NO_PRICING_TIERS",
            level="info",
            message="No patient pricing tiers configured",
            recommendation="Consider adding pricing tiers (General, Staff, BPL, Senior) for differential pricing",
        ))

    # Price history
    if sc.priceChangeCount == 0 and sc.totalServiceItems > 10:
        insights.append(PricingInsight(
            id="NO_PRICE_HISTORY",
            level="info",
            message="No price changes recorded yet",
            recommendation="Price history is auto-tracked when base prices change",
        ))

    return PricingRecommendation(
        insights=insights,
        serviceCoveragePercent=round(coverage, 1),
    )
