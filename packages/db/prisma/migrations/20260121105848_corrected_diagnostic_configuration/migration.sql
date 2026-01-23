/*
  Warnings:

  - You are about to drop the `DiagnosticChargeMap` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DiagnosticServicePointType" AS ENUM ('LAB', 'RADIOLOGY', 'CARDIO_DIAGNOSTICS', 'NEURO_DIAGNOSTICS', 'PULMONARY_DIAGNOSTICS', 'ENDOSCOPY', 'OTHER');

-- CreateEnum
CREATE TYPE "DiagnosticModality" AS ENUM ('XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAPHY', 'FLUOROSCOPY', 'ECG', 'ECHO', 'TMT', 'HOLTER', 'PFT', 'EEG', 'EMG_NCV', 'LAB', 'SAMPLE_COLLECTION', 'PROCEDURE_ROOM', 'OTHER');

-- DropForeignKey
ALTER TABLE "DiagnosticChargeMap" DROP CONSTRAINT "DiagnosticChargeMap_diagnosticItemId_fkey";

-- DropTable
DROP TABLE "DiagnosticChargeMap";

-- CreateTable
CREATE TABLE "DiagnosticServicePoint" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "locationNodeId" TEXT NOT NULL,
    "unitId" TEXT,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "DiagnosticServicePointType" NOT NULL DEFAULT 'OTHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticServicePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticServicePointRoom" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "servicePointId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "modality" "DiagnosticModality" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticServicePointRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticServicePointResource" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "servicePointId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "modality" "DiagnosticModality" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticServicePointResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticServicePointEquipment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "servicePointId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "modality" "DiagnosticModality" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticServicePointEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticCapability" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "diagnosticItemId" TEXT NOT NULL,
    "servicePointId" TEXT NOT NULL,
    "modality" "DiagnosticModality",
    "defaultDurationMins" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticCapabilityRoom" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticCapabilityRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticCapabilityResource" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticCapabilityResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticCapabilityEquipment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticCapabilityEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosticServicePoint_branchId_type_isActive_sortOrder_idx" ON "DiagnosticServicePoint"("branchId", "type", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "DiagnosticServicePoint_branchId_locationNodeId_idx" ON "DiagnosticServicePoint"("branchId", "locationNodeId");

-- CreateIndex
CREATE INDEX "DiagnosticServicePoint_branchId_unitId_idx" ON "DiagnosticServicePoint"("branchId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticServicePoint_branchId_code_key" ON "DiagnosticServicePoint"("branchId", "code");

-- CreateIndex
CREATE INDEX "DiagnosticServicePointRoom_branchId_servicePointId_isActive_idx" ON "DiagnosticServicePointRoom"("branchId", "servicePointId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticServicePointRoom_branchId_roomId_idx" ON "DiagnosticServicePointRoom"("branchId", "roomId");

-- CreateIndex
CREATE INDEX "DiagnosticServicePointRoom_branchId_modality_isActive_idx" ON "DiagnosticServicePointRoom"("branchId", "modality", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticServicePointRoom_servicePointId_roomId_key" ON "DiagnosticServicePointRoom"("servicePointId", "roomId");

-- CreateIndex
CREATE INDEX "DiagnosticServicePointResource_branchId_servicePointId_isAc_idx" ON "DiagnosticServicePointResource"("branchId", "servicePointId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticServicePointResource_branchId_resourceId_idx" ON "DiagnosticServicePointResource"("branchId", "resourceId");

-- CreateIndex
CREATE INDEX "DiagnosticServicePointResource_branchId_modality_isActive_idx" ON "DiagnosticServicePointResource"("branchId", "modality", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticServicePointResource_servicePointId_resourceId_key" ON "DiagnosticServicePointResource"("servicePointId", "resourceId");

-- CreateIndex
CREATE INDEX "DiagnosticServicePointEquipment_branchId_servicePointId_isA_idx" ON "DiagnosticServicePointEquipment"("branchId", "servicePointId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticServicePointEquipment_branchId_equipmentId_idx" ON "DiagnosticServicePointEquipment"("branchId", "equipmentId");

-- CreateIndex
CREATE INDEX "DiagnosticServicePointEquipment_branchId_modality_isActive_idx" ON "DiagnosticServicePointEquipment"("branchId", "modality", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticServicePointEquipment_servicePointId_equipmentId_key" ON "DiagnosticServicePointEquipment"("servicePointId", "equipmentId");

-- CreateIndex
CREATE INDEX "DiagnosticCapability_branchId_diagnosticItemId_isActive_idx" ON "DiagnosticCapability"("branchId", "diagnosticItemId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticCapability_branchId_servicePointId_isActive_idx" ON "DiagnosticCapability"("branchId", "servicePointId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticCapability_modality_isActive_idx" ON "DiagnosticCapability"("modality", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticCapability_servicePointId_diagnosticItemId_key" ON "DiagnosticCapability"("servicePointId", "diagnosticItemId");

-- CreateIndex
CREATE INDEX "DiagnosticCapabilityRoom_branchId_capabilityId_isActive_idx" ON "DiagnosticCapabilityRoom"("branchId", "capabilityId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticCapabilityRoom_branchId_roomId_idx" ON "DiagnosticCapabilityRoom"("branchId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticCapabilityRoom_capabilityId_roomId_key" ON "DiagnosticCapabilityRoom"("capabilityId", "roomId");

-- CreateIndex
CREATE INDEX "DiagnosticCapabilityResource_branchId_capabilityId_isActive_idx" ON "DiagnosticCapabilityResource"("branchId", "capabilityId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticCapabilityResource_branchId_resourceId_idx" ON "DiagnosticCapabilityResource"("branchId", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticCapabilityResource_capabilityId_resourceId_key" ON "DiagnosticCapabilityResource"("capabilityId", "resourceId");

-- CreateIndex
CREATE INDEX "DiagnosticCapabilityEquipment_branchId_capabilityId_isActiv_idx" ON "DiagnosticCapabilityEquipment"("branchId", "capabilityId", "isActive");

-- CreateIndex
CREATE INDEX "DiagnosticCapabilityEquipment_branchId_equipmentId_idx" ON "DiagnosticCapabilityEquipment"("branchId", "equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticCapabilityEquipment_capabilityId_equipmentId_key" ON "DiagnosticCapabilityEquipment"("capabilityId", "equipmentId");

-- AddForeignKey
ALTER TABLE "DiagnosticServicePoint" ADD CONSTRAINT "DiagnosticServicePoint_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticServicePoint" ADD CONSTRAINT "DiagnosticServicePoint_locationNodeId_fkey" FOREIGN KEY ("locationNodeId") REFERENCES "LocationNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticServicePoint" ADD CONSTRAINT "DiagnosticServicePoint_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticServicePointRoom" ADD CONSTRAINT "DiagnosticServicePointRoom_servicePointId_fkey" FOREIGN KEY ("servicePointId") REFERENCES "DiagnosticServicePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticServicePointRoom" ADD CONSTRAINT "DiagnosticServicePointRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "UnitRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticServicePointResource" ADD CONSTRAINT "DiagnosticServicePointResource_servicePointId_fkey" FOREIGN KEY ("servicePointId") REFERENCES "DiagnosticServicePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticServicePointResource" ADD CONSTRAINT "DiagnosticServicePointResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "UnitResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticServicePointEquipment" ADD CONSTRAINT "DiagnosticServicePointEquipment_servicePointId_fkey" FOREIGN KEY ("servicePointId") REFERENCES "DiagnosticServicePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticServicePointEquipment" ADD CONSTRAINT "DiagnosticServicePointEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCapability" ADD CONSTRAINT "DiagnosticCapability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCapability" ADD CONSTRAINT "DiagnosticCapability_diagnosticItemId_fkey" FOREIGN KEY ("diagnosticItemId") REFERENCES "DiagnosticItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCapability" ADD CONSTRAINT "DiagnosticCapability_servicePointId_fkey" FOREIGN KEY ("servicePointId") REFERENCES "DiagnosticServicePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCapabilityRoom" ADD CONSTRAINT "DiagnosticCapabilityRoom_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "DiagnosticCapability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCapabilityRoom" ADD CONSTRAINT "DiagnosticCapabilityRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "UnitRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCapabilityResource" ADD CONSTRAINT "DiagnosticCapabilityResource_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "DiagnosticCapability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCapabilityResource" ADD CONSTRAINT "DiagnosticCapabilityResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "UnitResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCapabilityEquipment" ADD CONSTRAINT "DiagnosticCapabilityEquipment_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "DiagnosticCapability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCapabilityEquipment" ADD CONSTRAINT "DiagnosticCapabilityEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
