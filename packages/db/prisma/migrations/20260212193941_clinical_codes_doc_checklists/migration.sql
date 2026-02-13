-- CreateEnum
CREATE TYPE "DocChecklistScope" AS ENUM ('ALL_CASES', 'CASHLESS_ONLY', 'REIMBURSEMENT_ONLY', 'PACKAGE_ONLY');

-- AlterTable
ALTER TABLE "ClaimLineItem" ADD COLUMN     "cptCode" VARCHAR(16),
ADD COLUMN     "cptDescription" VARCHAR(240),
ADD COLUMN     "diagnosisRef" VARCHAR(64),
ADD COLUMN     "icdCode" VARCHAR(16),
ADD COLUMN     "icdDescription" VARCHAR(240),
ADD COLUMN     "modifiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "placeOfService" VARCHAR(4),
ADD COLUMN     "snomedCode" VARCHAR(24);

-- AlterTable
ALTER TABLE "PreauthRequest" ADD COLUMN     "hbpPackageCode" VARCHAR(48),
ADD COLUMN     "implantDetails" TEXT,
ADD COLUMN     "investigationSummary" TEXT,
ADD COLUMN     "otNotes" TEXT,
ADD COLUMN     "primaryDiagnosisCode" VARCHAR(16),
ADD COLUMN     "primaryDiagnosisDesc" VARCHAR(240),
ADD COLUMN     "procedureCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "secondaryDiagnosisCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PayerDocumentTemplate" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "scope" "DocChecklistScope" NOT NULL DEFAULT 'ALL_CASES',
    "caseTypes" "InsuranceCaseType"[] DEFAULT ARRAY[]::"InsuranceCaseType"[],
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayerDocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayerDocumentRule" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "docRole" "InsuranceDocRole" NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "requiredAt" VARCHAR(48),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayerDocumentRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayerDocumentTemplate_branchId_payerId_idx" ON "PayerDocumentTemplate"("branchId", "payerId");

-- CreateIndex
CREATE UNIQUE INDEX "PayerDocumentTemplate_branchId_payerId_name_key" ON "PayerDocumentTemplate"("branchId", "payerId", "name");

-- CreateIndex
CREATE INDEX "PayerDocumentRule_templateId_idx" ON "PayerDocumentRule"("templateId");

-- AddForeignKey
ALTER TABLE "PayerDocumentTemplate" ADD CONSTRAINT "PayerDocumentTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerDocumentTemplate" ADD CONSTRAINT "PayerDocumentTemplate_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerDocumentRule" ADD CONSTRAINT "PayerDocumentRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PayerDocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
