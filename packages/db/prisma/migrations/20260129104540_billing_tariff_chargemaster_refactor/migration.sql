/*
  Warnings:

  - You are about to drop the column `payerType` on the `TariffPlan` table. All the data in the column will be lost.
  - You are about to alter the column `code` on the `TariffPlan` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(48)`.
  - You are about to alter the column `name` on the `TariffPlan` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(160)`.
  - The `status` column on the `TariffPlan` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `serviceCode` on the `TariffRate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tariffPlanId,chargeMasterItemId,version]` on the table `TariffRate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chargeMasterItemId` to the `TariffRate` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FixItEntityType" AS ENUM ('SERVICE_ITEM', 'CHARGE_MASTER_ITEM', 'TARIFF_PLAN', 'TARIFF_RATE', 'SERVICE_CATALOGUE', 'SERVICE_PACKAGE', 'ORDER_SET', 'DIAGNOSTIC_ITEM');

-- CreateEnum
CREATE TYPE "FixItSeverity" AS ENUM ('BLOCKER', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('GST', 'TDS', 'OTHER');

-- CreateEnum
CREATE TYPE "PayerKind" AS ENUM ('CASH', 'INSURANCE', 'TPA', 'CORPORATE', 'GOVERNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "TariffPlanKind" AS ENUM ('PRICE_LIST', 'PAYER_CONTRACT');

-- CreateEnum
CREATE TYPE "TariffPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "PackagePricingMode" AS ENUM ('COMPONENT_SUM', 'FIXED', 'DISCOUNT_PERCENT', 'DISCOUNT_AMOUNT', 'CAP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FixItTaskType" ADD VALUE 'SERVICE_AVAILABILITY_MISSING';
ALTER TYPE "FixItTaskType" ADD VALUE 'TARIFF_RATE_MISSING';
ALTER TYPE "FixItTaskType" ADD VALUE 'TAX_CODE_MISSING';
ALTER TYPE "FixItTaskType" ADD VALUE 'PACKAGE_PRICING_MISSING';
ALTER TYPE "FixItTaskType" ADD VALUE 'CHARGE_UNIT_MISMATCH';
ALTER TYPE "FixItTaskType" ADD VALUE 'CLONE_MISSING_SERVICE_ITEM';
ALTER TYPE "FixItTaskType" ADD VALUE 'CLONE_MISSING_DIAGNOSTIC_ITEM';
ALTER TYPE "FixItTaskType" ADD VALUE 'CLONE_MISSING_CHARGE_MASTER_ITEM';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServiceChargeUnit" ADD VALUE 'PER_PROCEDURE';
ALTER TYPE "ServiceChargeUnit" ADD VALUE 'PER_PACKAGE';

-- DropForeignKey
ALTER TABLE "TariffPlan" DROP CONSTRAINT "TariffPlan_branchId_fkey";

-- DropIndex
DROP INDEX "TariffRate_tariffPlanId_serviceCode_key";

-- AlterTable
ALTER TABLE "ChargeMasterItem" ADD COLUMN     "billingPolicy" JSONB,
ADD COLUMN     "chargeUnit" "ServiceChargeUnit" NOT NULL DEFAULT 'PER_UNIT',
ADD COLUMN     "hsnSac" VARCHAR(16),
ADD COLUMN     "isTaxInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxCodeId" TEXT;

-- AlterTable
ALTER TABLE "FixItTask" ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" "FixItEntityType",
ADD COLUMN     "severity" "FixItSeverity" NOT NULL DEFAULT 'BLOCKER';

-- AlterTable
ALTER TABLE "OrderSet" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedByUserId" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedByUserId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "OrderSetItem" ADD COLUMN     "isOptional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rules" JSONB;

-- AlterTable
ALTER TABLE "OrderSetVersion" ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "ServiceItem" ADD COLUMN     "anesthesiaClass" VARCHAR(80),
ADD COLUMN     "procedureKind" VARCHAR(80),
ADD COLUMN     "taxCodeId" TEXT;

-- AlterTable
ALTER TABLE "ServicePackage" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "billingChargeMasterItemId" TEXT,
ADD COLUMN     "chargeUnit" "ServiceChargeUnit" NOT NULL DEFAULT 'PER_UNIT',
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "isTaxInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pricingMode" "PackagePricingMode" NOT NULL DEFAULT 'COMPONENT_SUM',
ADD COLUMN     "pricingPolicy" JSONB,
ADD COLUMN     "pricingValue" DECIMAL(12,2),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedByUserId" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedByUserId" TEXT,
ADD COLUMN     "taxCodeId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "ServicePackageVersion" ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "TariffPlan" DROP COLUMN "payerType",
ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "currency" VARCHAR(8) NOT NULL DEFAULT 'INR',
ADD COLUMN     "isTaxInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "TariffPlanKind" NOT NULL DEFAULT 'PRICE_LIST',
ADD COLUMN     "payerId" TEXT,
ALTER COLUMN "code" SET DATA TYPE VARCHAR(48),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(160),
DROP COLUMN "status",
ADD COLUMN     "status" "TariffPlanStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "effectiveFrom" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TariffRate" DROP COLUMN "serviceCode",
ADD COLUMN     "chargeMasterItemId" TEXT NOT NULL,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "isTaxInclusive" BOOLEAN,
ADD COLUMN     "rules" JSONB,
ADD COLUMN     "taxCodeId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TaxCode" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "taxType" "TaxType" NOT NULL DEFAULT 'GST',
    "ratePercent" DECIMAL(7,4) NOT NULL,
    "components" JSONB,
    "hsnSac" VARCHAR(16),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payer" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "kind" "PayerKind" NOT NULL DEFAULT 'OTHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayerContract" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "terms" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayerContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxCode_branchId_taxType_isActive_idx" ON "TaxCode"("branchId", "taxType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCode_branchId_code_key" ON "TaxCode"("branchId", "code");

-- CreateIndex
CREATE INDEX "Payer_branchId_kind_isActive_idx" ON "Payer"("branchId", "kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Payer_branchId_code_key" ON "Payer"("branchId", "code");

-- CreateIndex
CREATE INDEX "PayerContract_branchId_payerId_status_idx" ON "PayerContract"("branchId", "payerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayerContract_branchId_code_key" ON "PayerContract"("branchId", "code");

-- CreateIndex
CREATE INDEX "ChargeMasterItem_branchId_taxCodeId_idx" ON "ChargeMasterItem"("branchId", "taxCodeId");

-- CreateIndex
CREATE INDEX "FixItTask_branchId_severity_status_idx" ON "FixItTask"("branchId", "severity", "status");

-- CreateIndex
CREATE INDEX "FixItTask_branchId_entityType_idx" ON "FixItTask"("branchId", "entityType");

-- CreateIndex
CREATE INDEX "OrderSet_branchId_departmentId_status_idx" ON "OrderSet"("branchId", "departmentId", "status");

-- CreateIndex
CREATE INDEX "ServicePackage_branchId_pricingMode_idx" ON "ServicePackage"("branchId", "pricingMode");

-- CreateIndex
CREATE INDEX "TariffPlan_branchId_kind_status_idx" ON "TariffPlan"("branchId", "kind", "status");

-- CreateIndex
CREATE INDEX "TariffPlan_branchId_payerId_idx" ON "TariffPlan"("branchId", "payerId");

-- CreateIndex
CREATE INDEX "TariffPlan_branchId_contractId_idx" ON "TariffPlan"("branchId", "contractId");

-- CreateIndex
CREATE INDEX "TariffRate_tariffPlanId_chargeMasterItemId_effectiveFrom_idx" ON "TariffRate"("tariffPlanId", "chargeMasterItemId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TariffRate_tariffPlanId_chargeMasterItemId_version_key" ON "TariffRate"("tariffPlanId", "chargeMasterItemId", "version");

-- AddForeignKey
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerContract" ADD CONSTRAINT "PayerContract_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerContract" ADD CONSTRAINT "PayerContract_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffPlan" ADD CONSTRAINT "TariffPlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffPlan" ADD CONSTRAINT "TariffPlan_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffPlan" ADD CONSTRAINT "TariffPlan_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "PayerContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRate" ADD CONSTRAINT "TariffRate_chargeMasterItemId_fkey" FOREIGN KEY ("chargeMasterItemId") REFERENCES "ChargeMasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRate" ADD CONSTRAINT "TariffRate_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRate" ADD CONSTRAINT "TariffRate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMasterItem" ADD CONSTRAINT "ChargeMasterItem_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_billingChargeMasterItemId_fkey" FOREIGN KEY ("billingChargeMasterItemId") REFERENCES "ChargeMasterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackageVersion" ADD CONSTRAINT "ServicePackageVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSet" ADD CONSTRAINT "OrderSet_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSet" ADD CONSTRAINT "OrderSet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSet" ADD CONSTRAINT "OrderSet_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSet" ADD CONSTRAINT "OrderSet_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSet" ADD CONSTRAINT "OrderSet_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSet" ADD CONSTRAINT "OrderSet_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSetVersion" ADD CONSTRAINT "OrderSetVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
