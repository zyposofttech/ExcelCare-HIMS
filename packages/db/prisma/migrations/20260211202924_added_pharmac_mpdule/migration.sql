-- CreateEnum
CREATE TYPE "PharmacyStoreType" AS ENUM ('MAIN', 'IP_PHARMACY', 'OP_PHARMACY', 'EMERGENCY', 'OT_STORE', 'ICU_STORE', 'WARD_STORE', 'NARCOTICS');

-- CreateEnum
CREATE TYPE "PharmacyStoreStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_SETUP');

-- CreateEnum
CREATE TYPE "DrugCategory" AS ENUM ('TABLET', 'CAPSULE', 'INJECTION', 'SYRUP', 'OINTMENT', 'DROPS', 'INHALER', 'SUPPOSITORY', 'PATCH', 'POWDER', 'IV_FLUID', 'OTHER');

-- CreateEnum
CREATE TYPE "DrugRoute" AS ENUM ('ORAL', 'IV', 'IM', 'SC', 'TOPICAL', 'INHALATION', 'RECTAL', 'OPHTHALMIC', 'NASAL', 'SUBLINGUAL', 'TRANSDERMAL');

-- CreateEnum
CREATE TYPE "DrugScheduleClass" AS ENUM ('GENERAL', 'H', 'H1', 'X', 'G');

-- CreateEnum
CREATE TYPE "DrugFormularyStatus" AS ENUM ('APPROVED', 'RESTRICTED', 'NON_FORMULARY');

-- CreateEnum
CREATE TYPE "DrugLifecycleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RECALLED');

-- CreateEnum
CREATE TYPE "FormularyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PharmSupplierStatus" AS ENUM ('ACTIVE', 'BLACKLISTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InteractionSeverity" AS ENUM ('MAJOR', 'MODERATE', 'MINOR');

-- CreateEnum
CREATE TYPE "InteractionSource" AS ENUM ('STANDARD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NarcoticsTransactionType" AS ENUM ('RECEIPT', 'ISSUE', 'WASTAGE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "PharmacyStore" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "storeCode" VARCHAR(32) NOT NULL,
    "storeName" VARCHAR(160) NOT NULL,
    "storeType" "PharmacyStoreType" NOT NULL,
    "parentStoreId" TEXT,
    "locationNodeId" TEXT,
    "pharmacistInChargeId" TEXT,
    "drugLicenseNumber" VARCHAR(64),
    "drugLicenseExpiry" TIMESTAMP(3),
    "is24x7" BOOLEAN NOT NULL DEFAULT false,
    "canDispense" BOOLEAN NOT NULL DEFAULT false,
    "canIndent" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveStock" BOOLEAN NOT NULL DEFAULT false,
    "canReturnVendor" BOOLEAN NOT NULL DEFAULT false,
    "operatingHours" JSONB,
    "autoIndentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "PharmacyStoreStatus" NOT NULL DEFAULT 'UNDER_SETUP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugMaster" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "drugCode" VARCHAR(32) NOT NULL,
    "genericName" VARCHAR(255) NOT NULL,
    "brandName" VARCHAR(255),
    "manufacturer" VARCHAR(255),
    "category" "DrugCategory" NOT NULL,
    "dosageForm" VARCHAR(120),
    "strength" VARCHAR(60),
    "route" "DrugRoute",
    "therapeuticClass" VARCHAR(160),
    "pharmacologicalClass" VARCHAR(160),
    "scheduleClass" "DrugScheduleClass" NOT NULL DEFAULT 'GENERAL',
    "isNarcotic" BOOLEAN NOT NULL DEFAULT false,
    "isPsychotropic" BOOLEAN NOT NULL DEFAULT false,
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    "isAntibiotic" BOOLEAN NOT NULL DEFAULT false,
    "isHighAlert" BOOLEAN NOT NULL DEFAULT false,
    "isLasa" BOOLEAN NOT NULL DEFAULT false,
    "mrp" DECIMAL(12,2),
    "purchasePrice" DECIMAL(12,2),
    "hsnCode" VARCHAR(16),
    "gstRate" DECIMAL(5,2),
    "packSize" INTEGER,
    "defaultDosage" VARCHAR(160),
    "maxDailyDose" VARCHAR(80),
    "contraindications" JSONB,
    "formularyStatus" "DrugFormularyStatus" NOT NULL DEFAULT 'APPROVED',
    "status" "DrugLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugInteraction" (
    "id" TEXT NOT NULL,
    "drugAId" TEXT NOT NULL,
    "drugBId" TEXT NOT NULL,
    "severity" "InteractionSeverity" NOT NULL,
    "description" VARCHAR(500),
    "recommendation" VARCHAR(500),
    "source" "InteractionSource" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formulary" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "status" "FormularyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormularyItem" (
    "id" TEXT NOT NULL,
    "formularyId" TEXT NOT NULL,
    "drugMasterId" TEXT NOT NULL,
    "tier" "DrugFormularyStatus" NOT NULL DEFAULT 'APPROVED',
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormularyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapeuticSubstitution" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sourceDrugId" TEXT NOT NULL,
    "targetDrugId" TEXT NOT NULL,
    "notes" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TherapeuticSubstitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmSupplier" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierCode" VARCHAR(32) NOT NULL,
    "supplierName" VARCHAR(255) NOT NULL,
    "gstin" VARCHAR(15),
    "drugLicenseNumber" VARCHAR(64),
    "drugLicenseExpiry" TIMESTAMP(3),
    "contactPerson" VARCHAR(160),
    "phone" VARCHAR(20),
    "email" VARCHAR(120),
    "address" VARCHAR(500),
    "paymentTermsDays" INTEGER,
    "discountTerms" VARCHAR(255),
    "deliveryLeadTimeDays" INTEGER,
    "productCategories" JSONB,
    "rating" DECIMAL(3,1),
    "status" "PharmSupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierStoreMapping" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "pharmacyStoreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierStoreMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryConfig" (
    "id" TEXT NOT NULL,
    "pharmacyStoreId" TEXT NOT NULL,
    "drugMasterId" TEXT NOT NULL,
    "minimumStock" INTEGER,
    "maximumStock" INTEGER,
    "reorderLevel" INTEGER,
    "reorderQuantity" INTEGER,
    "safetyStock" INTEGER,
    "abcClass" VARCHAR(1),
    "vedClass" VARCHAR(1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreIndentMapping" (
    "id" TEXT NOT NULL,
    "requestingStoreId" TEXT NOT NULL,
    "supplyingStoreId" TEXT NOT NULL,
    "approvalRole" VARCHAR(80),
    "slaDurationMinutes" INTEGER,
    "isEmergencyOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreIndentMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarcoticsRegister" (
    "id" TEXT NOT NULL,
    "pharmacyStoreId" TEXT NOT NULL,
    "drugMasterId" TEXT NOT NULL,
    "transactionType" "NarcoticsTransactionType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "batchNumber" VARCHAR(64),
    "balanceBefore" DECIMAL(12,3) NOT NULL,
    "balanceAfter" DECIMAL(12,3) NOT NULL,
    "witnessName" VARCHAR(160),
    "witnessSignature" VARCHAR(500),
    "notes" VARCHAR(500),
    "performedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NarcoticsRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugLicenseHistory" (
    "id" TEXT NOT NULL,
    "pharmacyStoreId" TEXT NOT NULL,
    "licenseNumber" VARCHAR(64) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "documentUrl" VARCHAR(500),
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugLicenseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PharmacyStore_branchId_storeType_status_idx" ON "PharmacyStore"("branchId", "storeType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyStore_branchId_storeCode_key" ON "PharmacyStore"("branchId", "storeCode");

-- CreateIndex
CREATE INDEX "DrugMaster_branchId_genericName_idx" ON "DrugMaster"("branchId", "genericName");

-- CreateIndex
CREATE INDEX "DrugMaster_branchId_category_status_idx" ON "DrugMaster"("branchId", "category", "status");

-- CreateIndex
CREATE INDEX "DrugMaster_branchId_scheduleClass_idx" ON "DrugMaster"("branchId", "scheduleClass");

-- CreateIndex
CREATE UNIQUE INDEX "DrugMaster_branchId_drugCode_key" ON "DrugMaster"("branchId", "drugCode");

-- CreateIndex
CREATE INDEX "DrugInteraction_drugAId_idx" ON "DrugInteraction"("drugAId");

-- CreateIndex
CREATE INDEX "DrugInteraction_drugBId_idx" ON "DrugInteraction"("drugBId");

-- CreateIndex
CREATE UNIQUE INDEX "DrugInteraction_drugAId_drugBId_key" ON "DrugInteraction"("drugAId", "drugBId");

-- CreateIndex
CREATE INDEX "Formulary_branchId_status_idx" ON "Formulary"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Formulary_branchId_version_key" ON "Formulary"("branchId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FormularyItem_formularyId_drugMasterId_key" ON "FormularyItem"("formularyId", "drugMasterId");

-- CreateIndex
CREATE INDEX "TherapeuticSubstitution_branchId_sourceDrugId_idx" ON "TherapeuticSubstitution"("branchId", "sourceDrugId");

-- CreateIndex
CREATE INDEX "PharmSupplier_branchId_status_idx" ON "PharmSupplier"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PharmSupplier_branchId_supplierCode_key" ON "PharmSupplier"("branchId", "supplierCode");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierStoreMapping_supplierId_pharmacyStoreId_key" ON "SupplierStoreMapping"("supplierId", "pharmacyStoreId");

-- CreateIndex
CREATE INDEX "InventoryConfig_pharmacyStoreId_idx" ON "InventoryConfig"("pharmacyStoreId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryConfig_pharmacyStoreId_drugMasterId_key" ON "InventoryConfig"("pharmacyStoreId", "drugMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreIndentMapping_requestingStoreId_supplyingStoreId_key" ON "StoreIndentMapping"("requestingStoreId", "supplyingStoreId");

-- CreateIndex
CREATE INDEX "NarcoticsRegister_pharmacyStoreId_drugMasterId_createdAt_idx" ON "NarcoticsRegister"("pharmacyStoreId", "drugMasterId", "createdAt");

-- CreateIndex
CREATE INDEX "DrugLicenseHistory_pharmacyStoreId_validTo_idx" ON "DrugLicenseHistory"("pharmacyStoreId", "validTo");

-- AddForeignKey
ALTER TABLE "PharmacyStore" ADD CONSTRAINT "PharmacyStore_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStore" ADD CONSTRAINT "PharmacyStore_parentStoreId_fkey" FOREIGN KEY ("parentStoreId") REFERENCES "PharmacyStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStore" ADD CONSTRAINT "PharmacyStore_locationNodeId_fkey" FOREIGN KEY ("locationNodeId") REFERENCES "LocationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStore" ADD CONSTRAINT "PharmacyStore_pharmacistInChargeId_fkey" FOREIGN KEY ("pharmacistInChargeId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugMaster" ADD CONSTRAINT "DrugMaster_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugInteraction" ADD CONSTRAINT "DrugInteraction_drugAId_fkey" FOREIGN KEY ("drugAId") REFERENCES "DrugMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugInteraction" ADD CONSTRAINT "DrugInteraction_drugBId_fkey" FOREIGN KEY ("drugBId") REFERENCES "DrugMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formulary" ADD CONSTRAINT "Formulary_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formulary" ADD CONSTRAINT "Formulary_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormularyItem" ADD CONSTRAINT "FormularyItem_formularyId_fkey" FOREIGN KEY ("formularyId") REFERENCES "Formulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormularyItem" ADD CONSTRAINT "FormularyItem_drugMasterId_fkey" FOREIGN KEY ("drugMasterId") REFERENCES "DrugMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapeuticSubstitution" ADD CONSTRAINT "TherapeuticSubstitution_sourceDrugId_fkey" FOREIGN KEY ("sourceDrugId") REFERENCES "DrugMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapeuticSubstitution" ADD CONSTRAINT "TherapeuticSubstitution_targetDrugId_fkey" FOREIGN KEY ("targetDrugId") REFERENCES "DrugMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmSupplier" ADD CONSTRAINT "PharmSupplier_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierStoreMapping" ADD CONSTRAINT "SupplierStoreMapping_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierStoreMapping" ADD CONSTRAINT "SupplierStoreMapping_pharmacyStoreId_fkey" FOREIGN KEY ("pharmacyStoreId") REFERENCES "PharmacyStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryConfig" ADD CONSTRAINT "InventoryConfig_pharmacyStoreId_fkey" FOREIGN KEY ("pharmacyStoreId") REFERENCES "PharmacyStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryConfig" ADD CONSTRAINT "InventoryConfig_drugMasterId_fkey" FOREIGN KEY ("drugMasterId") REFERENCES "DrugMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreIndentMapping" ADD CONSTRAINT "StoreIndentMapping_requestingStoreId_fkey" FOREIGN KEY ("requestingStoreId") REFERENCES "PharmacyStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreIndentMapping" ADD CONSTRAINT "StoreIndentMapping_supplyingStoreId_fkey" FOREIGN KEY ("supplyingStoreId") REFERENCES "PharmacyStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarcoticsRegister" ADD CONSTRAINT "NarcoticsRegister_pharmacyStoreId_fkey" FOREIGN KEY ("pharmacyStoreId") REFERENCES "PharmacyStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarcoticsRegister" ADD CONSTRAINT "NarcoticsRegister_drugMasterId_fkey" FOREIGN KEY ("drugMasterId") REFERENCES "DrugMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarcoticsRegister" ADD CONSTRAINT "NarcoticsRegister_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugLicenseHistory" ADD CONSTRAINT "DrugLicenseHistory_pharmacyStoreId_fkey" FOREIGN KEY ("pharmacyStoreId") REFERENCES "PharmacyStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugLicenseHistory" ADD CONSTRAINT "DrugLicenseHistory_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
