-- CreateEnum
CREATE TYPE "DiagnosticKind" AS ENUM ('LAB', 'IMAGING', 'PROCEDURE');

-- CreateEnum
CREATE TYPE "DiagnosticResultDataType" AS ENUM ('NUMERIC', 'TEXT', 'BOOLEAN', 'CHOICE');

-- CreateEnum
CREATE TYPE "DiagnosticTemplateKind" AS ENUM ('IMAGING_REPORT', 'LAB_REPORT');

-- CreateTable
CREATE TABLE "DiagnosticSection" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticCategory" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecimenType" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "container" TEXT,
    "minVolumeMl" DOUBLE PRECISION,
    "handlingNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecimenType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticItem" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DiagnosticKind" NOT NULL,
    "sectionId" TEXT NOT NULL,
    "categoryId" TEXT,
    "specimenId" TEXT,
    "tatMinsRoutine" INTEGER,
    "tatMinsStat" INTEGER,
    "requiresAppointment" BOOLEAN NOT NULL DEFAULT false,
    "preparationText" TEXT,
    "consentRequired" BOOLEAN NOT NULL DEFAULT false,
    "isPanel" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticPanelItem" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticPanelItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticParameter" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" "DiagnosticResultDataType" NOT NULL,
    "unit" TEXT,
    "precision" INTEGER,
    "allowedText" TEXT,
    "criticalLow" DOUBLE PRECISION,
    "criticalHigh" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticReferenceRange" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "sex" TEXT,
    "ageMinDays" INTEGER,
    "ageMaxDays" INTEGER,
    "low" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "textRange" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticReferenceRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticTemplate" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" "DiagnosticTemplateKind" NOT NULL DEFAULT 'IMAGING_REPORT',
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticChargeMap" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "diagnosticItemId" TEXT NOT NULL,
    "chargeMasterId" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticChargeMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosticSection_branchId_isActive_idx" ON "DiagnosticSection"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticSection_branchId_code_key" ON "DiagnosticSection"("branchId", "code");

-- CreateIndex
CREATE INDEX "DiagnosticCategory_branchId_sectionId_isActive_idx" ON "DiagnosticCategory"("branchId", "sectionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticCategory_branchId_code_key" ON "DiagnosticCategory"("branchId", "code");

-- CreateIndex
CREATE INDEX "SpecimenType_branchId_isActive_idx" ON "SpecimenType"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SpecimenType_branchId_code_key" ON "SpecimenType"("branchId", "code");

-- CreateIndex
CREATE INDEX "DiagnosticItem_branchId_kind_isActive_idx" ON "DiagnosticItem"("branchId", "kind", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticItem_branchId_sectionId_categoryId_idx" ON "DiagnosticItem"("branchId", "sectionId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticItem_branchId_code_key" ON "DiagnosticItem"("branchId", "code");

-- CreateIndex
CREATE INDEX "DiagnosticPanelItem_panelId_isActive_idx" ON "DiagnosticPanelItem"("panelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticPanelItem_panelId_itemId_key" ON "DiagnosticPanelItem"("panelId", "itemId");

-- CreateIndex
CREATE INDEX "DiagnosticParameter_testId_isActive_idx" ON "DiagnosticParameter"("testId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticParameter_testId_code_key" ON "DiagnosticParameter"("testId", "code");

-- CreateIndex
CREATE INDEX "DiagnosticReferenceRange_parameterId_isActive_idx" ON "DiagnosticReferenceRange"("parameterId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticTemplate_itemId_kind_isActive_idx" ON "DiagnosticTemplate"("itemId", "kind", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticChargeMap_branchId_isActive_idx" ON "DiagnosticChargeMap"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticChargeMap_diagnosticItemId_isActive_idx" ON "DiagnosticChargeMap"("diagnosticItemId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticChargeMap_branchId_diagnosticItemId_chargeMasterI_key" ON "DiagnosticChargeMap"("branchId", "diagnosticItemId", "chargeMasterId");

-- AddForeignKey
ALTER TABLE "DiagnosticCategory" ADD CONSTRAINT "DiagnosticCategory_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DiagnosticSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticItem" ADD CONSTRAINT "DiagnosticItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DiagnosticSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticItem" ADD CONSTRAINT "DiagnosticItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DiagnosticCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticItem" ADD CONSTRAINT "DiagnosticItem_specimenId_fkey" FOREIGN KEY ("specimenId") REFERENCES "SpecimenType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticPanelItem" ADD CONSTRAINT "DiagnosticPanelItem_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "DiagnosticItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticPanelItem" ADD CONSTRAINT "DiagnosticPanelItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DiagnosticItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticParameter" ADD CONSTRAINT "DiagnosticParameter_testId_fkey" FOREIGN KEY ("testId") REFERENCES "DiagnosticItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticReferenceRange" ADD CONSTRAINT "DiagnosticReferenceRange_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "DiagnosticParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticTemplate" ADD CONSTRAINT "DiagnosticTemplate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DiagnosticItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticChargeMap" ADD CONSTRAINT "DiagnosticChargeMap_diagnosticItemId_fkey" FOREIGN KEY ("diagnosticItemId") REFERENCES "DiagnosticItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
