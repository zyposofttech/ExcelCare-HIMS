"""Payer Contract Analyzer Engine — contract profitability and coverage analysis."""

from __future__ import annotations

from pydantic import BaseModel, Field

from src.collectors.models import BranchContext


class ContractInsight(BaseModel):
    id: str
    level: str  # "info" | "warning" | "critical"
    message: str
    recommendation: str | None = None


class ContractAnalysisResult(BaseModel):
    totalPayers: int = 0
    totalContracts: int = 0
    activeContracts: int = 0
    insights: list[ContractInsight] = Field(default_factory=list)
    coverageScore: int = 0  # 0-100


def analyze_contracts(ctx: BranchContext) -> ContractAnalysisResult:
    """Analyze payer contracts for coverage, completeness, and risk."""
    sc = ctx.serviceCatalog
    insights: list[ContractInsight] = []

    # Coverage score
    score = 0
    if sc.totalPayers > 0:
        score += 20
    if sc.hasCashPayer:
        score += 10
    if sc.activeContracts > 0:
        score += 20
    if sc.totalTariffPlans > 0:
        score += 15
    if sc.totalGovSchemes > 0:
        score += 10
    if sc.totalPricingTiers > 0:
        score += 10
    if sc.totalTaxCodes > 0:
        score += 15

    # No payers configured
    if sc.totalPayers == 0:
        insights.append(ContractInsight(
            id="NO_PAYERS",
            level="critical",
            message="No payers configured",
            recommendation="Add payers (CASH, Insurance, TPA, Government, Corporate) to enable billing workflows",
        ))

    # Active payers without contracts
    payers_without = sc.activePayers - sc.activeContracts
    if payers_without > 0 and sc.activePayers > 0:
        insights.append(ContractInsight(
            id="PAYERS_WITHOUT_CONTRACTS",
            level="warning",
            message=f"~{payers_without} active payer(s) may not have active contracts",
            recommendation="Ensure each active payer has at least one active contract with pricing terms",
        ))

    # Government scheme checks
    if sc.totalGovSchemes == 0 and sc.totalPayers > 0:
        insights.append(ContractInsight(
            id="NO_GOV_SCHEMES",
            level="info",
            message="No government scheme configurations found",
            recommendation="If applicable, configure PMJAY, CGHS, or ECHS schemes for government-insured patients",
        ))

    # Expired contracts
    if sc.expiredContracts > 0:
        level = "critical" if sc.expiredContracts > sc.activeContracts else "warning"
        insights.append(ContractInsight(
            id="EXPIRED_CONTRACTS",
            level=level,
            message=f"{sc.expiredContracts} contract(s) expired",
            recommendation="Review expired contracts — renew or terminate them",
        ))

    # No CASH payer
    if not sc.hasCashPayer:
        insights.append(ContractInsight(
            id="NO_CASH_PAYER",
            level="critical",
            message="No CASH payer configured — self-pay patients have no billing path",
            recommendation="Create a CASH payer with default rates to handle self-pay patients",
        ))

    # Payer kind distribution
    if sc.byPayerKind:
        if "INSURANCE" not in sc.byPayerKind and "TPA" not in sc.byPayerKind:
            insights.append(ContractInsight(
                id="NO_INSURANCE_PAYERS",
                level="info",
                message="No insurance or TPA payers configured",
                recommendation="Add insurance/TPA payers if the hospital works with insurance companies",
            ))

    return ContractAnalysisResult(
        totalPayers=sc.totalPayers,
        totalContracts=sc.totalContracts,
        activeContracts=sc.activeContracts,
        insights=insights,
        coverageScore=min(score, 100),
    )
