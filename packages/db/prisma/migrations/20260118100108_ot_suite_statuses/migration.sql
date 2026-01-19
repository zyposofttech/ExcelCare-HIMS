/*
  Warnings:

  - The values [ANESTHESIA,MONITORING,SURGICAL_LIGHT,DIATHERMY,SUCTION,INFUSION,INSTRUMENTS,OT_TABLE,CSSD] on the enum `OtEquipmentCategory` will be removed. If these variants are still used in the database, this will fail.
  - The values [DRAFT,READY,ARCHIVED] on the enum `OtSuiteStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OtEquipmentCategory_new" AS ENUM ('ANESTHESIA_MACHINE', 'AIRWAY_MANAGEMENT', 'VENTILATION_RESPIRATORY', 'PATIENT_MONITORING', 'HEMODYNAMIC_MONITORING', 'SURGICAL_INSTRUMENTS', 'OR_FURNITURE', 'OR_LIGHTING', 'ELECTROSURGERY_ENERGY', 'ENDOSCOPY_LAPAROSCOPY', 'IMAGING_INTRAOP', 'STERILIZATION_CSSD', 'DISINFECTION_CLEANING', 'STERILE_STORAGE_PACKAGING', 'MEDICAL_GASES', 'SUCTION_SYSTEMS', 'POWER_BACKUP', 'PATIENT_WARMING', 'DVT_PROPHYLAXIS', 'SAFETY_EMERGENCY', 'RECOVERY_PACU_EQUIPMENT', 'IT_AV_EQUIPMENT', 'CONSUMABLES_DISPOSABLES', 'OTHER');
ALTER TABLE "OtEquipment" ALTER COLUMN "category" TYPE "OtEquipmentCategory_new" USING ("category"::text::"OtEquipmentCategory_new");
ALTER TYPE "OtEquipmentCategory" RENAME TO "OtEquipmentCategory_old";
ALTER TYPE "OtEquipmentCategory_new" RENAME TO "OtEquipmentCategory";
DROP TYPE "OtEquipmentCategory_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OtSuiteStatus_new" AS ENUM ('draft', 'ready', 'active', 'booked', 'in_use', 'maintenance', 'archived');
ALTER TABLE "OtSuite" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OtSuite" ALTER COLUMN "status" TYPE "OtSuiteStatus_new" USING ("status"::text::"OtSuiteStatus_new");
ALTER TYPE "OtSuiteStatus" RENAME TO "OtSuiteStatus_old";
ALTER TYPE "OtSuiteStatus_new" RENAME TO "OtSuiteStatus";
DROP TYPE "OtSuiteStatus_old";
ALTER TABLE "OtSuite" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- AlterTable
ALTER TABLE "OtEquipment" ALTER COLUMN "category" SET DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "OtSuite" ALTER COLUMN "status" SET DEFAULT 'draft';
