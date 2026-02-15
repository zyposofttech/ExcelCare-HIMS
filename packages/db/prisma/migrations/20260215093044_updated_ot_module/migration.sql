-- CreateEnum
CREATE TYPE "OtStaffRole" AS ENUM ('OT_IN_CHARGE', 'OT_TECHNICIAN', 'SCRUB_NURSE', 'CIRCULATING_NURSE', 'RECOVERY_NURSE', 'OT_ATTENDANT', 'HOUSEKEEPING', 'ANESTHESIA_TECHNICIAN');

-- CreateEnum
CREATE TYPE "OtSessionType" AS ENUM ('ELECTIVE', 'EMERGENCY', 'BOTH');

-- CreateEnum
CREATE TYPE "OtSurgeryCategory" AS ENUM ('MINOR', 'MAJOR', 'COMPLEX', 'DAYCARE');

-- CreateEnum
CREATE TYPE "OtChargeComponentType" AS ENUM ('THEATRE_CHARGE', 'ANESTHESIA_CHARGE', 'SURGEON_FEE', 'ASSISTANT_SURGEON_FEE', 'MATERIAL_CHARGE', 'IMPLANT_CHARGE', 'MONITORING_CHARGE');

-- CreateEnum
CREATE TYPE "OtChargeModel" AS ENUM ('PER_HOUR', 'PER_SLAB', 'FLAT');

-- CreateEnum
CREATE TYPE "OtComplianceConfigType" AS ENUM ('WHO_CHECKLIST', 'INFECTION_ZONE', 'FUMIGATION', 'BIOMEDICAL_WASTE', 'FIRE_SAFETY', 'SSI_SURVEILLANCE');

-- CreateEnum
CREATE TYPE "OtChecklistPhase" AS ENUM ('SIGN_IN', 'TIME_OUT', 'SIGN_OUT', 'PRE_OP', 'SPECIALTY');

-- CreateEnum
CREATE TYPE "OtZoneType" AS ENUM ('UNRESTRICTED', 'SEMI_RESTRICTED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "OtBookingApprovalMode" AS ENUM ('DIRECT', 'APPROVAL_REQUIRED', 'AUTO_APPROVE_NOTIFY');

-- CreateEnum
CREATE TYPE "OtReviewAction" AS ENUM ('APPROVED', 'REJECTED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "OtDecommissionType" AS ENUM ('TEMPORARY', 'PERMANENT');

-- CreateEnum
CREATE TYPE "OtImplantCategory" AS ENUM ('ORTHOPEDIC', 'CARDIAC', 'OPHTHALMIC', 'GENERAL');

-- CreateEnum
CREATE TYPE "OtEmergencyCategory" AS ENUM ('IMMEDIATE', 'URGENT', 'EXPEDITED');

-- CreateEnum
CREATE TYPE "OtCancellationAuthority" AS ENUM ('SURGEON', 'OT_IN_CHARGE', 'ADMIN');

-- AlterTable
ALTER TABLE "OtRecoveryBay" ADD COLUMN     "defaultRecoveryComplex" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "defaultRecoveryMajor" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "defaultRecoveryMinor" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "monitoringStationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nurseToPatientRatio" TEXT,
ADD COLUMN     "suctionPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OtSuite" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activatedByUserId" TEXT,
ADD COLUMN     "lastValidationAt" TIMESTAMP(3),
ADD COLUMN     "lastValidationScore" INTEGER,
ADD COLUMN     "reviewStatus" TEXT;

-- AlterTable
ALTER TABLE "OtTheatre" ADD COLUMN     "area" DOUBLE PRECISION,
ADD COLUMN     "bufferEmergencyMin" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "ceilingHeight" DOUBLE PRECISION,
ADD COLUMN     "cleaningTimeMin" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "defaultSlotComplex" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN     "defaultSlotMajor" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "defaultSlotMinor" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "emergencyLighting" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gasAir" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gasAirOutlets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gasN2O" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gasN2OOutlets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gasO2" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gasO2Outlets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gasVacuum" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gasVacuumOutlets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "humidityMax" DOUBLE PRECISION,
ADD COLUMN     "humidityMin" DOUBLE PRECISION,
ADD COLUMN     "is24x7Emergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEmergencyEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isolatedPowerSupply" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "luxLevel" INTEGER,
ADD COLUMN     "maxCasesPerDay" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "tempMax" DOUBLE PRECISION,
ADD COLUMN     "tempMin" DOUBLE PRECISION,
ADD COLUMN     "turnaroundTimeMin" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "upsOutlets" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OtSchedulingRule" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "theatreSpaceId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sessionType" "OtSessionType" NOT NULL,
    "lunchStart" TEXT,
    "lunchEnd" TEXT,
    "specialtyCode" TEXT,
    "isEffectiveDated" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtSchedulingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtStaffAssignment" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "role" "OtStaffRole" NOT NULL,
    "defaultShift" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtSurgeonPrivilege" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "theatreSpaceId" TEXT,
    "staffId" TEXT NOT NULL,
    "specialtyCode" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtSurgeonPrivilege_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtAnesthetistPrivilege" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "theatreSpaceId" TEXT,
    "staffId" TEXT NOT NULL,
    "concurrentCaseLimit" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtAnesthetistPrivilege_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtMinStaffingRule" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "theatreSpaceId" TEXT,
    "surgeryCategory" "OtSurgeryCategory" NOT NULL,
    "minSurgeons" INTEGER NOT NULL DEFAULT 1,
    "minAnesthetists" INTEGER NOT NULL DEFAULT 1,
    "minScrubNurses" INTEGER NOT NULL DEFAULT 1,
    "minCirculatingNurses" INTEGER NOT NULL DEFAULT 1,
    "minOtTechnicians" INTEGER NOT NULL DEFAULT 0,
    "minAnesthesiaTechnicians" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtMinStaffingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtZoneAccessRule" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "zone" "OtZoneType" NOT NULL,
    "allowedRoles" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtZoneAccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtStoreLink" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "pharmacyStoreId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtStoreLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtConsumableTemplate" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surgeryCategory" "OtSurgeryCategory" NOT NULL,
    "specialtyCode" TEXT,
    "items" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtConsumableTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtImplantTrackingRule" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "category" "OtImplantCategory" NOT NULL,
    "mandatoryBarcodeScan" BOOLEAN NOT NULL DEFAULT true,
    "mandatoryBatchSerial" BOOLEAN NOT NULL DEFAULT true,
    "mandatoryManufacturer" BOOLEAN NOT NULL DEFAULT true,
    "mandatoryPatientConsent" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtImplantTrackingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtParLevel" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "drugMasterId" TEXT,
    "minStock" INTEGER NOT NULL,
    "reorderLevel" INTEGER NOT NULL,
    "reorderQty" INTEGER NOT NULL,
    "maxStock" INTEGER NOT NULL,
    "isNeverOutOfStock" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtParLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtSurgeryTypeDefault" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "category" "OtSurgeryCategory" NOT NULL,
    "minDurationMin" INTEGER NOT NULL,
    "defaultDurationMin" INTEGER NOT NULL,
    "maxDurationMin" INTEGER NOT NULL,
    "requiresIcuBooking" BOOLEAN NOT NULL DEFAULT false,
    "requiresBloodReservation" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtSurgeryTypeDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtChecklistTemplate" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" "OtChecklistPhase" NOT NULL,
    "templateType" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtCancellationPolicy" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "cancellationAuthority" "OtCancellationAuthority"[],
    "mandatoryReasonRequired" BOOLEAN NOT NULL DEFAULT true,
    "reasons" JSONB,
    "maxReschedulesPerCase" INTEGER NOT NULL DEFAULT 3,
    "priorityBoostOnReschedule" BOOLEAN NOT NULL DEFAULT false,
    "autoNotifyPatient" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtCancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtBookingApprovalConfig" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "defaultMode" "OtBookingApprovalMode" NOT NULL DEFAULT 'DIRECT',
    "minorMode" "OtBookingApprovalMode" NOT NULL DEFAULT 'DIRECT',
    "majorMode" "OtBookingApprovalMode" NOT NULL DEFAULT 'APPROVAL_REQUIRED',
    "complexMode" "OtBookingApprovalMode" NOT NULL DEFAULT 'APPROVAL_REQUIRED',
    "emergencyMode" "OtBookingApprovalMode" NOT NULL DEFAULT 'DIRECT',
    "approvalTimeoutHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtBookingApprovalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtUtilizationTarget" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "metricCode" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "alertThresholdLow" DOUBLE PRECISION,
    "alertThresholdHigh" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtUtilizationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtRecoveryProtocol" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "surgeryCategory" "OtSurgeryCategory" NOT NULL,
    "monitoringFrequencyMin" INTEGER NOT NULL DEFAULT 15,
    "mandatoryVitals" JSONB NOT NULL,
    "minRecoveryDurationMin" INTEGER NOT NULL DEFAULT 30,
    "dischargeScoreThreshold" INTEGER NOT NULL DEFAULT 9,
    "escalationRules" JSONB,
    "dischargeSignOffRole" TEXT NOT NULL DEFAULT 'RECOVERY_NURSE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtRecoveryProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtNotificationRule" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "recipientRoles" TEXT[],
    "channels" TEXT[],
    "timing" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtServiceLink" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "serviceItemId" TEXT NOT NULL,
    "specialtyCode" TEXT NOT NULL,
    "surgeryCategory" "OtSurgeryCategory" NOT NULL,
    "defaultTheatreType" "OtTheatreType",
    "requiredEquipmentCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "snomedCode" TEXT,
    "icd10PcsCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtServiceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtChargeComponent" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "componentType" "OtChargeComponentType" NOT NULL,
    "chargeModel" "OtChargeModel" NOT NULL,
    "serviceItemId" TEXT,
    "glCode" TEXT,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT false,
    "defaultRate" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtChargeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtComplianceConfig" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "configType" "OtComplianceConfigType" NOT NULL,
    "config" JSONB NOT NULL,
    "lastAuditAt" TIMESTAMP(3),
    "nextAuditDue" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtComplianceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtEmergencyPolicy" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "hasDedicatedEmergencyOt" BOOLEAN NOT NULL DEFAULT false,
    "dedicatedTheatreSpaceId" TEXT,
    "availability" TEXT NOT NULL DEFAULT '24x7',
    "escalationRule" TEXT NOT NULL DEFAULT 'QUEUE_WITH_ETA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtEmergencyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtGoLiveValidation" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "runByUserId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "totalChecks" INTEGER NOT NULL,
    "passedChecks" INTEGER NOT NULL,
    "blockersFailed" INTEGER NOT NULL,
    "warningsFailed" INTEGER NOT NULL,
    "results" JSONB NOT NULL,

    CONSTRAINT "OtGoLiveValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtReviewRecord" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "action" "OtReviewAction" NOT NULL,
    "comments" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtReviewRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtSchedulingRule_suiteId_idx" ON "OtSchedulingRule"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtSchedulingRule_suiteId_theatreSpaceId_dayOfWeek_startTime_key" ON "OtSchedulingRule"("suiteId", "theatreSpaceId", "dayOfWeek", "startTime", "specialtyCode");

-- CreateIndex
CREATE INDEX "OtStaffAssignment_suiteId_idx" ON "OtStaffAssignment"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtStaffAssignment_suiteId_staffId_role_key" ON "OtStaffAssignment"("suiteId", "staffId", "role");

-- CreateIndex
CREATE INDEX "OtSurgeonPrivilege_suiteId_idx" ON "OtSurgeonPrivilege"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtSurgeonPrivilege_suiteId_theatreSpaceId_staffId_key" ON "OtSurgeonPrivilege"("suiteId", "theatreSpaceId", "staffId");

-- CreateIndex
CREATE INDEX "OtAnesthetistPrivilege_suiteId_idx" ON "OtAnesthetistPrivilege"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtAnesthetistPrivilege_suiteId_theatreSpaceId_staffId_key" ON "OtAnesthetistPrivilege"("suiteId", "theatreSpaceId", "staffId");

-- CreateIndex
CREATE INDEX "OtMinStaffingRule_suiteId_idx" ON "OtMinStaffingRule"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtMinStaffingRule_suiteId_theatreSpaceId_surgeryCategory_key" ON "OtMinStaffingRule"("suiteId", "theatreSpaceId", "surgeryCategory");

-- CreateIndex
CREATE UNIQUE INDEX "OtZoneAccessRule_spaceId_key" ON "OtZoneAccessRule"("spaceId");

-- CreateIndex
CREATE INDEX "OtZoneAccessRule_suiteId_idx" ON "OtZoneAccessRule"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtZoneAccessRule_suiteId_spaceId_key" ON "OtZoneAccessRule"("suiteId", "spaceId");

-- CreateIndex
CREATE INDEX "OtStoreLink_suiteId_idx" ON "OtStoreLink"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtStoreLink_suiteId_linkType_key" ON "OtStoreLink"("suiteId", "linkType");

-- CreateIndex
CREATE INDEX "OtConsumableTemplate_suiteId_idx" ON "OtConsumableTemplate"("suiteId");

-- CreateIndex
CREATE INDEX "OtImplantTrackingRule_suiteId_idx" ON "OtImplantTrackingRule"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtImplantTrackingRule_suiteId_category_key" ON "OtImplantTrackingRule"("suiteId", "category");

-- CreateIndex
CREATE INDEX "OtParLevel_suiteId_idx" ON "OtParLevel"("suiteId");

-- CreateIndex
CREATE INDEX "OtSurgeryTypeDefault_suiteId_idx" ON "OtSurgeryTypeDefault"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtSurgeryTypeDefault_suiteId_category_key" ON "OtSurgeryTypeDefault"("suiteId", "category");

-- CreateIndex
CREATE INDEX "OtChecklistTemplate_suiteId_idx" ON "OtChecklistTemplate"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtCancellationPolicy_suiteId_key" ON "OtCancellationPolicy"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtBookingApprovalConfig_suiteId_key" ON "OtBookingApprovalConfig"("suiteId");

-- CreateIndex
CREATE INDEX "OtUtilizationTarget_suiteId_idx" ON "OtUtilizationTarget"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtUtilizationTarget_suiteId_metricCode_key" ON "OtUtilizationTarget"("suiteId", "metricCode");

-- CreateIndex
CREATE INDEX "OtRecoveryProtocol_suiteId_idx" ON "OtRecoveryProtocol"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtRecoveryProtocol_suiteId_surgeryCategory_key" ON "OtRecoveryProtocol"("suiteId", "surgeryCategory");

-- CreateIndex
CREATE INDEX "OtNotificationRule_suiteId_idx" ON "OtNotificationRule"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtNotificationRule_suiteId_eventType_key" ON "OtNotificationRule"("suiteId", "eventType");

-- CreateIndex
CREATE INDEX "OtServiceLink_suiteId_idx" ON "OtServiceLink"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtServiceLink_suiteId_serviceItemId_key" ON "OtServiceLink"("suiteId", "serviceItemId");

-- CreateIndex
CREATE INDEX "OtChargeComponent_suiteId_idx" ON "OtChargeComponent"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtChargeComponent_suiteId_componentType_key" ON "OtChargeComponent"("suiteId", "componentType");

-- CreateIndex
CREATE INDEX "OtComplianceConfig_suiteId_idx" ON "OtComplianceConfig"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtComplianceConfig_suiteId_configType_key" ON "OtComplianceConfig"("suiteId", "configType");

-- CreateIndex
CREATE UNIQUE INDEX "OtEmergencyPolicy_suiteId_key" ON "OtEmergencyPolicy"("suiteId");

-- CreateIndex
CREATE INDEX "OtGoLiveValidation_suiteId_idx" ON "OtGoLiveValidation"("suiteId");

-- CreateIndex
CREATE INDEX "OtReviewRecord_suiteId_idx" ON "OtReviewRecord"("suiteId");

-- AddForeignKey
ALTER TABLE "OtSchedulingRule" ADD CONSTRAINT "OtSchedulingRule_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtSchedulingRule" ADD CONSTRAINT "OtSchedulingRule_theatreSpaceId_fkey" FOREIGN KEY ("theatreSpaceId") REFERENCES "OtSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtStaffAssignment" ADD CONSTRAINT "OtStaffAssignment_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtSurgeonPrivilege" ADD CONSTRAINT "OtSurgeonPrivilege_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtSurgeonPrivilege" ADD CONSTRAINT "OtSurgeonPrivilege_theatreSpaceId_fkey" FOREIGN KEY ("theatreSpaceId") REFERENCES "OtSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtAnesthetistPrivilege" ADD CONSTRAINT "OtAnesthetistPrivilege_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtAnesthetistPrivilege" ADD CONSTRAINT "OtAnesthetistPrivilege_theatreSpaceId_fkey" FOREIGN KEY ("theatreSpaceId") REFERENCES "OtSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtMinStaffingRule" ADD CONSTRAINT "OtMinStaffingRule_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtMinStaffingRule" ADD CONSTRAINT "OtMinStaffingRule_theatreSpaceId_fkey" FOREIGN KEY ("theatreSpaceId") REFERENCES "OtSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtZoneAccessRule" ADD CONSTRAINT "OtZoneAccessRule_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtZoneAccessRule" ADD CONSTRAINT "OtZoneAccessRule_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "OtSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtStoreLink" ADD CONSTRAINT "OtStoreLink_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtConsumableTemplate" ADD CONSTRAINT "OtConsumableTemplate_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtImplantTrackingRule" ADD CONSTRAINT "OtImplantTrackingRule_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtParLevel" ADD CONSTRAINT "OtParLevel_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtSurgeryTypeDefault" ADD CONSTRAINT "OtSurgeryTypeDefault_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtChecklistTemplate" ADD CONSTRAINT "OtChecklistTemplate_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtCancellationPolicy" ADD CONSTRAINT "OtCancellationPolicy_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtBookingApprovalConfig" ADD CONSTRAINT "OtBookingApprovalConfig_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtUtilizationTarget" ADD CONSTRAINT "OtUtilizationTarget_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtRecoveryProtocol" ADD CONSTRAINT "OtRecoveryProtocol_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtNotificationRule" ADD CONSTRAINT "OtNotificationRule_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtServiceLink" ADD CONSTRAINT "OtServiceLink_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtChargeComponent" ADD CONSTRAINT "OtChargeComponent_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtComplianceConfig" ADD CONSTRAINT "OtComplianceConfig_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtEmergencyPolicy" ADD CONSTRAINT "OtEmergencyPolicy_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtGoLiveValidation" ADD CONSTRAINT "OtGoLiveValidation_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtReviewRecord" ADD CONSTRAINT "OtReviewRecord_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "OtSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
