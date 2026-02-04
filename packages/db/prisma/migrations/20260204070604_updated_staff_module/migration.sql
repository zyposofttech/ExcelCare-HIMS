/*
  Warnings:

  - The values [TRAINEE,SHARED_SERVICE] on the enum `StaffAssignmentType` will be removed. If these variants are still used in the database, this will fail.
  - The values [MEDICAL_REGISTRATION,NURSING_REGISTRATION,PHARMACY_REGISTRATION,TECHNICIAN_LICENSE] on the enum `StaffCredentialType` will be removed. If these variants are still used in the database, this will fail.
  - The values [VISITING_CONSULTANT,VENDOR_STAFF] on the enum `StaffEngagementType` will be removed. If these variants are still used in the database, this will fail.
  - The values [VOTER_ID,DRIVING_LICENSE] on the enum `StaffIdentifierType` will be removed. If these variants are still used in the database, this will fail.
  - The values [INTEGRATION] on the enum `UserSource` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `headAssignmentId` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `designationPrimary` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `displayName` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `meta` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `staffNo` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `createdByUserId` on the `StaffAssignment` table. All the data in the column will be lost.
  - You are about to alter the column `branchEmpCode` on the `StaffAssignment` table. The data in that column could be lost. The data in that column will be cast from `VarChar(48)` to `VarChar(32)`.
  - You are about to drop the column `documentChecksum` on the `StaffCredential` table. All the data in the column will be lost.
  - You are about to drop the column `documentMime` on the `StaffCredential` table. All the data in the column will be lost.
  - You are about to drop the column `documentSize` on the `StaffCredential` table. All the data in the column will be lost.
  - You are about to drop the column `issuingAuthority` on the `StaffCredential` table. All the data in the column will be lost.
  - You are about to drop the column `meta` on the `StaffCredential` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `StaffCredential` table. All the data in the column will be lost.
  - You are about to alter the column `registrationNumber` on the `StaffCredential` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(64)`.
  - You are about to drop the column `last4` on the `StaffIdentifier` table. All the data in the column will be lost.
  - You are about to drop the column `meta` on the `StaffIdentifier` table. All the data in the column will be lost.
  - You are about to drop the column `fromStaffId` on the `StaffMergeLog` table. All the data in the column will be lost.
  - You are about to drop the column `intoStaffId` on the `StaffMergeLog` table. All the data in the column will be lost.
  - You are about to drop the column `meta` on the `StaffMergeLog` table. All the data in the column will be lost.
  - You are about to alter the column `reason` on the `StaffMergeLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(240)`.
  - You are about to drop the column `scope` on the `UserRoleBinding` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[empCode]` on the table `Staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hprId]` on the table `Staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,branchId,roleVersionId,staffAssignmentId]` on the table `UserRoleBinding` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `designation` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `empCode` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceStaffId` to the `StaffMergeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetStaffId` to the `StaffMergeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StaffMergeLog` table without a default value. This is not possible if the table is not empty.
  - Made the column `branchId` on table `UserRoleBinding` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "StaffAssignmentStatus" ADD VALUE 'PLANNED';

-- AlterEnum
BEGIN;
CREATE TYPE "StaffAssignmentType_new" AS ENUM ('PERMANENT', 'TEMPORARY', 'ROTATION', 'VISITING', 'LOCUM', 'CONTRACTOR', 'DEPUTATION', 'TRANSFER');
ALTER TABLE "StaffAssignment" ALTER COLUMN "assignmentType" DROP DEFAULT;
ALTER TABLE "StaffAssignment" ALTER COLUMN "assignmentType" TYPE "StaffAssignmentType_new" USING ("assignmentType"::text::"StaffAssignmentType_new");
ALTER TYPE "StaffAssignmentType" RENAME TO "StaffAssignmentType_old";
ALTER TYPE "StaffAssignmentType_new" RENAME TO "StaffAssignmentType";
DROP TYPE "StaffAssignmentType_old";
ALTER TABLE "StaffAssignment" ALTER COLUMN "assignmentType" SET DEFAULT 'PERMANENT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StaffCredentialType_new" AS ENUM ('MEDICAL_REG', 'NURSING_REG', 'PHARMACY_REG', 'TECH_CERT', 'OTHER');
ALTER TABLE "StaffCredential" ALTER COLUMN "type" TYPE "StaffCredentialType_new" USING ("type"::text::"StaffCredentialType_new");
ALTER TYPE "StaffCredentialType" RENAME TO "StaffCredentialType_old";
ALTER TYPE "StaffCredentialType_new" RENAME TO "StaffCredentialType";
DROP TYPE "StaffCredentialType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StaffEngagementType_new" AS ENUM ('EMPLOYEE', 'CONSULTANT', 'VISITING', 'LOCUM', 'CONTRACTOR', 'INTERN', 'TRAINEE', 'VENDOR');
ALTER TABLE "Staff" ALTER COLUMN "engagementType" DROP DEFAULT;
ALTER TABLE "Staff" ALTER COLUMN "engagementType" TYPE "StaffEngagementType_new" USING ("engagementType"::text::"StaffEngagementType_new");
ALTER TYPE "StaffEngagementType" RENAME TO "StaffEngagementType_old";
ALTER TYPE "StaffEngagementType_new" RENAME TO "StaffEngagementType";
DROP TYPE "StaffEngagementType_old";
ALTER TABLE "Staff" ALTER COLUMN "engagementType" SET DEFAULT 'EMPLOYEE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StaffIdentifierType_new" AS ENUM ('AADHAAR', 'PAN', 'PASSPORT', 'HPR_ID', 'OTHER');
ALTER TABLE "StaffIdentifier" ALTER COLUMN "type" TYPE "StaffIdentifierType_new" USING ("type"::text::"StaffIdentifierType_new");
ALTER TYPE "StaffIdentifierType" RENAME TO "StaffIdentifierType_old";
ALTER TYPE "StaffIdentifierType_new" RENAME TO "StaffIdentifierType";
DROP TYPE "StaffIdentifierType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserSource_new" AS ENUM ('ADMIN', 'STAFF', 'MANUAL', 'SYSTEM');
ALTER TABLE "User" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "source" TYPE "UserSource_new" USING ("source"::text::"UserSource_new");
ALTER TYPE "UserSource" RENAME TO "UserSource_old";
ALTER TYPE "UserSource_new" RENAME TO "UserSource";
DROP TYPE "UserSource_old";
ALTER TABLE "User" ALTER COLUMN "source" SET DEFAULT 'ADMIN';
COMMIT;

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_headAssignmentId_fkey";

-- DropForeignKey
ALTER TABLE "StaffAssignment" DROP CONSTRAINT "StaffAssignment_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "StaffMergeLog" DROP CONSTRAINT "StaffMergeLog_fromStaffId_fkey";

-- DropForeignKey
ALTER TABLE "StaffMergeLog" DROP CONSTRAINT "StaffMergeLog_intoStaffId_fkey";

-- DropIndex
DROP INDEX "Staff_category_status_idx";

-- DropIndex
DROP INDEX "Staff_fullName_idx";

-- DropIndex
DROP INDEX "Staff_staffNo_key";

-- DropIndex
DROP INDEX "StaffAssignment_departmentId_idx";

-- DropIndex
DROP INDEX "StaffAssignment_effectiveFrom_effectiveTo_idx";

-- DropIndex
DROP INDEX "StaffAssignment_specialtyId_idx";

-- DropIndex
DROP INDEX "StaffAssignment_staffId_branchId_departmentId_effectiveFrom_key";

-- DropIndex
DROP INDEX "StaffCredential_staffId_validTo_idx";

-- DropIndex
DROP INDEX "StaffCredential_type_registrationNumber_key";

-- DropIndex
DROP INDEX "StaffCredential_verificationStatus_validTo_idx";

-- DropIndex
DROP INDEX "StaffMergeLog_fromStaffId_idx";

-- DropIndex
DROP INDEX "StaffMergeLog_intoStaffId_mergedAt_idx";

-- DropIndex
DROP INDEX "UserRoleBinding_roleVersionId_idx";

-- DropIndex
DROP INDEX "UserRoleBinding_staffAssignmentId_idx";

-- DropIndex
DROP INDEX "UserRoleBinding_userId_branchId_idx";

-- DropIndex
DROP INDEX "UserRoleBinding_userId_effectiveFrom_effectiveTo_idx";

-- DropIndex
DROP INDEX "UserRoleBinding_userId_roleVersionId_branchId_effectiveFrom_key";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "headAssignmentId";

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "designationPrimary",
DROP COLUMN "displayName",
DROP COLUMN "fullName",
DROP COLUMN "meta",
DROP COLUMN "notes",
DROP COLUMN "staffNo",
ADD COLUMN     "designation" VARCHAR(120) NOT NULL,
ADD COLUMN     "empCode" VARCHAR(32) NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" VARCHAR(160) NOT NULL,
ALTER COLUMN "category" SET DEFAULT 'NON_MEDICAL';

-- AlterTable
ALTER TABLE "StaffAssignment" DROP COLUMN "createdByUserId",
ADD COLUMN     "unitId" TEXT,
ALTER COLUMN "branchEmpCode" SET DATA TYPE VARCHAR(32);

-- AlterTable
ALTER TABLE "StaffCredential" DROP COLUMN "documentChecksum",
DROP COLUMN "documentMime",
DROP COLUMN "documentSize",
DROP COLUMN "issuingAuthority",
DROP COLUMN "meta",
DROP COLUMN "notes",
ADD COLUMN     "authority" VARCHAR(120),
ALTER COLUMN "type" SET DEFAULT 'OTHER',
ALTER COLUMN "registrationNumber" DROP NOT NULL,
ALTER COLUMN "registrationNumber" SET DATA TYPE VARCHAR(64);

-- AlterTable
ALTER TABLE "StaffIdentifier" DROP COLUMN "last4",
DROP COLUMN "meta",
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "valueLast4" VARCHAR(8),
ALTER COLUMN "type" SET DEFAULT 'OTHER',
ALTER COLUMN "issuedBy" SET DATA TYPE VARCHAR(120);

-- AlterTable
ALTER TABLE "StaffMergeLog" DROP COLUMN "fromStaffId",
DROP COLUMN "intoStaffId",
DROP COLUMN "meta",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sourceStaffId" TEXT NOT NULL,
ADD COLUMN     "targetStaffId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "reason" SET DATA TYPE VARCHAR(240);

-- AlterTable
ALTER TABLE "UserRoleBinding" DROP COLUMN "scope",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "branchId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Staff_empCode_key" ON "Staff"("empCode");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_hprId_key" ON "Staff"("hprId");

-- CreateIndex
CREATE INDEX "Staff_name_idx" ON "Staff"("name");

-- CreateIndex
CREATE INDEX "Staff_status_isActive_idx" ON "Staff"("status", "isActive");

-- CreateIndex
CREATE INDEX "StaffAssignment_departmentId_status_idx" ON "StaffAssignment"("departmentId", "status");

-- CreateIndex
CREATE INDEX "StaffAssignment_specialtyId_status_idx" ON "StaffAssignment"("specialtyId", "status");

-- CreateIndex
CREATE INDEX "StaffAssignment_effectiveTo_idx" ON "StaffAssignment"("effectiveTo");

-- CreateIndex
CREATE INDEX "StaffCredential_validTo_idx" ON "StaffCredential"("validTo");

-- CreateIndex
CREATE INDEX "StaffCredential_verificationStatus_idx" ON "StaffCredential"("verificationStatus");

-- CreateIndex
CREATE INDEX "StaffMergeLog_sourceStaffId_idx" ON "StaffMergeLog"("sourceStaffId");

-- CreateIndex
CREATE INDEX "StaffMergeLog_targetStaffId_idx" ON "StaffMergeLog"("targetStaffId");

-- CreateIndex
CREATE INDEX "UserRoleBinding_userId_isActive_idx" ON "UserRoleBinding"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserRoleBinding_branchId_isActive_idx" ON "UserRoleBinding"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "UserRoleBinding_roleVersionId_isActive_idx" ON "UserRoleBinding"("roleVersionId", "isActive");

-- CreateIndex
CREATE INDEX "UserRoleBinding_effectiveTo_idx" ON "UserRoleBinding"("effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleBinding_userId_branchId_roleVersionId_staffAssignme_key" ON "UserRoleBinding"("userId", "branchId", "roleVersionId", "staffAssignmentId");

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMergeLog" ADD CONSTRAINT "StaffMergeLog_sourceStaffId_fkey" FOREIGN KEY ("sourceStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMergeLog" ADD CONSTRAINT "StaffMergeLog_targetStaffId_fkey" FOREIGN KEY ("targetStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
