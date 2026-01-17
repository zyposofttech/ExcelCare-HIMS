/*
  Warnings:

  - You are about to drop the `OT` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OtSuiteStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OtSpaceType" AS ENUM ('THEATRE', 'RECOVERY_BAY', 'PREOP_HOLDING', 'INDUCTION_ROOM', 'SCRUB_ROOM', 'STERILE_STORE', 'ANESTHESIA_STORE', 'EQUIPMENT_STORE', 'STAFF_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "OtTheatreType" AS ENUM ('GENERAL', 'MODULAR', 'LAMINAR', 'HYBRID');

-- CreateEnum
CREATE TYPE "OtAirflowType" AS ENUM ('STANDARD', 'LAMINAR');

-- CreateEnum
CREATE TYPE "OtPressureType" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "OtEquipmentCategory" AS ENUM ('ANESTHESIA', 'MONITORING', 'SURGICAL_LIGHT', 'DIATHERMY', 'SUCTION', 'INFUSION', 'INSTRUMENTS', 'OT_TABLE', 'CSSD', 'OTHER');

-- DropForeignKey
ALTER TABLE "OT" DROP CONSTRAINT "OT_branchId_fkey";

-- DropTable
DROP TABLE "OT";

-- CreateTable
CREATE TABLE "OtSuite" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "locationNodeId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OtSuiteStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtSuite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtSpace" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "type" "OtSpaceType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationNodeId" TEXT,
    "notes" TEXT,
    "meta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtTheatre" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "theatreType" "OtTheatreType" NOT NULL DEFAULT 'GENERAL',
    "airflow" "OtAirflowType" NOT NULL DEFAULT 'STANDARD',
    "pressure" "OtPressureType" NOT NULL DEFAULT 'POSITIVE',
    "isoClass" TEXT,
    "meta" JSONB,
    "specialtyCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtTheatre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtRecoveryBay" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "bedCount" INTEGER NOT NULL DEFAULT 1,
    "monitorCount" INTEGER NOT NULL DEFAULT 0,
    "oxygenPoints" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtRecoveryBay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtTable" (
    "id" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "installedAt" TIMESTAMP(3),
    "meta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtEquipment" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "spaceId" TEXT,
    "category" "OtEquipmentCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "lastServiceAt" TIMESTAMP(3),
    "nextServiceAt" TIMESTAMP(3),
    "maintenanceIntervalDays" INTEGER,
    "meta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtSuite_branchId_idx" ON "OtSuite"("branchId");

-- CreateIndex
CREATE INDEX "OtSuite_locationNodeId_idx" ON "OtSuite"("locationNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "OtSuite_branchId_code_key" ON "OtSuite"("branchId", "code");

-- CreateIndex
CREATE INDEX "OtSpace_suiteId_type_idx" ON "OtSpace"("suiteId", "type");

-- CreateIndex
CREATE INDEX "OtSpace_locationNodeId_idx" ON "OtSpace"("locationNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "OtSpace_suiteId_code_key" ON "OtSpace"("suiteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "OtTheatre_spaceId_key" ON "OtTheatre"("spaceId");

-- CreateIndex
CREATE INDEX "OtTheatre_spaceId_idx" ON "OtTheatre"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "OtRecoveryBay_spaceId_key" ON "OtRecoveryBay"("spaceId");

-- CreateIndex
CREATE INDEX "OtTable_theatreId_idx" ON "OtTable"("theatreId");

-- CreateIndex
CREATE UNIQUE INDEX "OtTable_theatreId_code_key" ON "OtTable"("theatreId", "code");

-- CreateIndex
CREATE INDEX "OtEquipment_suiteId_category_idx" ON "OtEquipment"("suiteId", "category");

-- CreateIndex
CREATE INDEX "OtEquipment_spaceId_idx" ON "OtEquipment"("spaceId");

-- AddForeignKey
ALTER TABLE "OtSuite" ADD CONSTRAINT "OtSuite_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtSuite" ADD CONSTRAINT "OtSuite_locationNodeId_fkey" FOREIGN KEY ("locationNodeId") REFERENCES "LocationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtSpace" ADD CONSTRAINT "OtSpace_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtSpace" ADD CONSTRAINT "OtSpace_locationNodeId_fkey" FOREIGN KEY ("locationNodeId") REFERENCES "LocationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtTheatre" ADD CONSTRAINT "OtTheatre_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "OtSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtRecoveryBay" ADD CONSTRAINT "OtRecoveryBay_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "OtSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtTable" ADD CONSTRAINT "OtTable_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "OtTheatre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtEquipment" ADD CONSTRAINT "OtEquipment_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtEquipment" ADD CONSTRAINT "OtEquipment_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "OtSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
