/*
  Warnings:

  - The `status` column on the `TariffPlan` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `amount` on the `TariffRate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tariffPlanId,serviceCode,version]` on the table `TariffRate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `rateAmount` to the `TariffRate` table without a default value. This is not possible if the table is not empty.
  - Made the column `isTaxInclusive` on table `TariffRate` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "TariffRate" DROP CONSTRAINT "TariffRate_chargeMasterItemId_fkey";

-- DropIndex
DROP INDEX "TariffPlan_branchId_kind_status_idx";

-- DropIndex
DROP INDEX "TariffRate_tariffPlanId_chargeMasterItemId_effectiveFrom_idx";

-- AlterTable
ALTER TABLE "TariffPlan" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payerType" TEXT NOT NULL DEFAULT 'SELF',
ADD COLUMN     "planStatus" "TariffPlanStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "TariffRate" DROP COLUMN "amount",
ADD COLUMN     "currency" VARCHAR(8) NOT NULL DEFAULT 'INR',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "rateAmount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "serviceCode" VARCHAR(48),
ALTER COLUMN "chargeMasterItemId" DROP NOT NULL,
ALTER COLUMN "isTaxInclusive" SET NOT NULL,
ALTER COLUMN "isTaxInclusive" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "TariffPlan_branchId_kind_planStatus_idx" ON "TariffPlan"("branchId", "kind", "planStatus");

-- CreateIndex
CREATE INDEX "TariffPlan_branchId_isDefault_idx" ON "TariffPlan"("branchId", "isDefault");

-- CreateIndex
CREATE INDEX "TariffRate_tariffPlanId_chargeMasterItemId_idx" ON "TariffRate"("tariffPlanId", "chargeMasterItemId");

-- CreateIndex
CREATE INDEX "TariffRate_tariffPlanId_serviceCode_idx" ON "TariffRate"("tariffPlanId", "serviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "TariffRate_tariffPlanId_serviceCode_version_key" ON "TariffRate"("tariffPlanId", "serviceCode", "version");

-- AddForeignKey
ALTER TABLE "TariffRate" ADD CONSTRAINT "TariffRate_chargeMasterItemId_fkey" FOREIGN KEY ("chargeMasterItemId") REFERENCES "ChargeMasterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
