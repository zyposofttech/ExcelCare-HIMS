-- CreateEnum
CREATE TYPE "PayerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PricingTierKind" AS ENUM ('GENERAL', 'SENIOR_CITIZEN', 'STAFF', 'EMPLOYEE_FAMILY', 'BPL', 'MEDICAL_COUNCIL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SchemeType" AS ENUM ('PMJAY', 'CGHS', 'ECHS', 'STATE_SCHEME', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractRateType" AS ENUM ('FIXED_PRICE', 'PERCENTAGE_OF_BASE', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "OverUtilizationPolicy" AS ENUM ('CHARGE_ADDITIONAL', 'ABSORB');

-- CreateEnum
CREATE TYPE "UnderUtilizationRefund" AS ENUM ('NO_REFUND', 'PARTIAL', 'FULL');

-- CreateEnum
CREATE TYPE "PricingStrategy" AS ENUM ('GLOBAL_DISCOUNT', 'CATEGORY_WISE', 'SERVICE_SPECIFIC');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayerKind" ADD VALUE 'TRUST';
ALTER TYPE "PayerKind" ADD VALUE 'EMPLOYEE';

-- AlterTable
ALTER TABLE "Payer" ADD COLUMN     "addresses" JSONB,
ADD COLUMN     "apiEndpoint" VARCHAR(500),
ADD COLUMN     "authMethod" VARCHAR(32),
ADD COLUMN     "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cinNumber" VARCHAR(21),
ADD COLUMN     "claimSubmissionMethod" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contacts" JSONB,
ADD COLUMN     "creditDays" INTEGER,
ADD COLUMN     "creditLimit" DECIMAL(14,2),
ADD COLUMN     "displayName" VARCHAR(200),
ADD COLUMN     "earlyPaymentDiscount" DECIMAL(5,2),
ADD COLUMN     "empanelmentEndDate" TIMESTAMP(3),
ADD COLUMN     "empanelmentLevel" VARCHAR(32),
ADD COLUMN     "empanelmentStartDate" TIMESTAMP(3),
ADD COLUMN     "gracePeriodDays" INTEGER,
ADD COLUMN     "gstinNumber" VARCHAR(15),
ADD COLUMN     "icuRentLimit" DECIMAL(12,2),
ADD COLUMN     "interestRate" DECIMAL(5,2),
ADD COLUMN     "irdaiRegistration" VARCHAR(64),
ADD COLUMN     "licenseNumber" VARCHAR(64),
ADD COLUMN     "licenseValidTill" TIMESTAMP(3),
ADD COLUMN     "networkType" VARCHAR(32),
ADD COLUMN     "panNumber" VARCHAR(10),
ADD COLUMN     "portalUrl" VARCHAR(500),
ADD COLUMN     "preauthThreshold" DECIMAL(12,2),
ADD COLUMN     "requiresPreauth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "roomRentLimit" DECIMAL(12,2),
ADD COLUMN     "settlementTerms" JSONB,
ADD COLUMN     "shortName" VARCHAR(100),
ADD COLUMN     "status" "PayerStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "supportingDocs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "webhookUrl" VARCHAR(500);

-- AlterTable
ALTER TABLE "PayerContract" ADD COLUMN     "afterHoursLoadingPercent" DECIMAL(5,2),
ADD COLUMN     "approvalStatus" VARCHAR(32),
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "copaymentRules" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "emergencyLoadingPercent" DECIMAL(5,2),
ADD COLUMN     "excludedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "excludedServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "globalDiscountPercent" DECIMAL(5,2),
ADD COLUMN     "gracePeriodDays" INTEGER,
ADD COLUMN     "pricingStrategy" "PricingStrategy",
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "statLoadingPercent" DECIMAL(5,2),
ADD COLUMN     "weekendLoadingPercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "ServiceCatalogue" ADD COLUMN     "filterRules" JSONB,
ADD COLUMN     "visibility" VARCHAR(32);

-- AlterTable
ALTER TABLE "ServiceItem" ADD COLUMN     "allowDiscount" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "basePrice" DECIMAL(12,2),
ADD COLUMN     "costPrice" DECIMAL(12,2),
ADD COLUMN     "defaultTatHours" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "displayName" VARCHAR(200),
ADD COLUMN     "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "effectiveTill" TIMESTAMP(3),
ADD COLUMN     "maxDiscountPercent" DECIMAL(5,2),
ADD COLUMN     "requiresScheduling" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "searchAliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "shortName" VARCHAR(100),
ADD COLUMN     "specialtyId" TEXT,
ADD COLUMN     "statAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subCategory" VARCHAR(80);

-- AlterTable
ALTER TABLE "ServicePackage" ADD COLUMN     "allowComponentAddition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowComponentRemoval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowQuantityChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "applicablePayerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "genderRestriction" VARCHAR(16),
ADD COLUMN     "maxAge" INTEGER,
ADD COLUMN     "minAge" INTEGER,
ADD COLUMN     "overUtilizationPolicy" "OverUtilizationPolicy",
ADD COLUMN     "requiresPreauth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "underUtilizationRefund" "UnderUtilizationRefund";

-- AlterTable
ALTER TABLE "ServicePackageComponent" ADD COLUMN     "unitPrice" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ServicePriceHistory" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "serviceItemId" TEXT,
    "chargeMasterItemId" TEXT,
    "tariffRateId" TEXT,
    "oldPrice" DECIMAL(12,2) NOT NULL,
    "newPrice" DECIMAL(12,2) NOT NULL,
    "changeAmount" DECIMAL(12,2) NOT NULL,
    "changePercent" DECIMAL(7,4) NOT NULL,
    "changeReason" VARCHAR(500),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTill" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractServiceRate" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "serviceItemId" TEXT,
    "packageId" TEXT,
    "chargeMasterItemId" TEXT,
    "category" VARCHAR(80),
    "rateType" "ContractRateType" NOT NULL DEFAULT 'FIXED_PRICE',
    "fixedPrice" DECIMAL(12,2),
    "percentageOfBase" DECIMAL(7,4),
    "discountPercent" DECIMAL(5,2),
    "minPrice" DECIMAL(12,2),
    "maxPrice" DECIMAL(12,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractServiceRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentSchemeConfig" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "schemeType" "SchemeType" NOT NULL,
    "schemeName" VARCHAR(160) NOT NULL,
    "schemeCode" VARCHAR(48) NOT NULL,
    "registrationNumber" VARCHAR(64),
    "registrationDate" TIMESTAMP(3),
    "validTill" TIMESTAMP(3),
    "shaCode" VARCHAR(64),
    "nhaCode" VARCHAR(64),
    "nhaHospitalCode" VARCHAR(64),
    "empaneledSpecialtyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preauthRequired" BOOLEAN NOT NULL DEFAULT true,
    "preauthAutoApprovalLimit" DECIMAL(12,2),
    "verificationMethod" VARCHAR(32),
    "packageMapping" JSONB,
    "claimSubmissionUrl" VARCHAR(500),
    "claimSubmissionMethod" VARCHAR(32),
    "claimSubmissionWindowDays" INTEGER,
    "claimProcessingTimeDays" INTEGER,
    "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentSchemeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPricingTier" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "kind" "PricingTierKind" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "description" TEXT,
    "assignmentRules" JSONB,
    "defaultDiscountPercent" DECIMAL(5,2),
    "defaultMarkupPercent" DECIMAL(5,2),
    "maxDiscountCap" DECIMAL(12,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPricingTierRate" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "serviceItemId" TEXT,
    "chargeMasterItemId" TEXT,
    "rateAmount" DECIMAL(12,2),
    "discountPercent" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPricingTierRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePriceHistory_branchId_serviceItemId_effectiveFrom_idx" ON "ServicePriceHistory"("branchId", "serviceItemId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ServicePriceHistory_branchId_chargeMasterItemId_effectiveFr_idx" ON "ServicePriceHistory"("branchId", "chargeMasterItemId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ContractServiceRate_contractId_serviceItemId_idx" ON "ContractServiceRate"("contractId", "serviceItemId");

-- CreateIndex
CREATE INDEX "ContractServiceRate_contractId_chargeMasterItemId_idx" ON "ContractServiceRate"("contractId", "chargeMasterItemId");

-- CreateIndex
CREATE INDEX "ContractServiceRate_contractId_category_idx" ON "ContractServiceRate"("contractId", "category");

-- CreateIndex
CREATE INDEX "GovernmentSchemeConfig_branchId_schemeType_isActive_idx" ON "GovernmentSchemeConfig"("branchId", "schemeType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentSchemeConfig_branchId_schemeCode_key" ON "GovernmentSchemeConfig"("branchId", "schemeCode");

-- CreateIndex
CREATE INDEX "PatientPricingTier_branchId_kind_isActive_idx" ON "PatientPricingTier"("branchId", "kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PatientPricingTier_branchId_code_key" ON "PatientPricingTier"("branchId", "code");

-- CreateIndex
CREATE INDEX "PatientPricingTierRate_tierId_serviceItemId_idx" ON "PatientPricingTierRate"("tierId", "serviceItemId");

-- CreateIndex
CREATE INDEX "PatientPricingTierRate_tierId_chargeMasterItemId_idx" ON "PatientPricingTierRate"("tierId", "chargeMasterItemId");

-- CreateIndex
CREATE INDEX "Payer_branchId_status_idx" ON "Payer"("branchId", "status");

-- CreateIndex
CREATE INDEX "ServiceItem_branchId_specialtyId_isActive_idx" ON "ServiceItem"("branchId", "specialtyId", "isActive");

-- AddForeignKey
ALTER TABLE "PayerContract" ADD CONSTRAINT "PayerContract_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceHistory" ADD CONSTRAINT "ServicePriceHistory_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceHistory" ADD CONSTRAINT "ServicePriceHistory_chargeMasterItemId_fkey" FOREIGN KEY ("chargeMasterItemId") REFERENCES "ChargeMasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceHistory" ADD CONSTRAINT "ServicePriceHistory_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceHistory" ADD CONSTRAINT "ServicePriceHistory_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractServiceRate" ADD CONSTRAINT "ContractServiceRate_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "PayerContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractServiceRate" ADD CONSTRAINT "ContractServiceRate_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractServiceRate" ADD CONSTRAINT "ContractServiceRate_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractServiceRate" ADD CONSTRAINT "ContractServiceRate_chargeMasterItemId_fkey" FOREIGN KEY ("chargeMasterItemId") REFERENCES "ChargeMasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentSchemeConfig" ADD CONSTRAINT "GovernmentSchemeConfig_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPricingTier" ADD CONSTRAINT "PatientPricingTier_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPricingTierRate" ADD CONSTRAINT "PatientPricingTierRate_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PatientPricingTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
