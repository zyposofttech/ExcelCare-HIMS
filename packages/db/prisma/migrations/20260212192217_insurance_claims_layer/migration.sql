-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'LAPSED');

-- CreateEnum
CREATE TYPE "PolicyRelationship" AS ENUM ('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER');

-- CreateEnum
CREATE TYPE "InsuranceCaseType" AS ENUM ('CASHLESS', 'REIMBURSEMENT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "InsuranceCaseStatus" AS ENUM ('DRAFT', 'POLICY_VERIFIED', 'PREAUTH_PENDING', 'PREAUTH_APPROVED', 'ADMITTED', 'DISCHARGE_PENDING', 'CLAIM_SUBMITTED', 'CLAIM_APPROVED', 'SETTLED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PreauthStatus" AS ENUM ('PREAUTH_DRAFT', 'PREAUTH_SUBMITTED', 'PREAUTH_QUERY_RAISED', 'PREAUTH_RESPONDED', 'PREAUTH_APPROVED', 'PREAUTH_REJECTED', 'PREAUTH_ENHANCEMENT_REQUESTED', 'PREAUTH_ENHANCEMENT_APPROVED', 'PREAUTH_EXPIRED');

-- CreateEnum
CREATE TYPE "PreauthQuerySource" AS ENUM ('TPA', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('CLAIM_DRAFT', 'CLAIM_SUBMITTED', 'CLAIM_ACKNOWLEDGED', 'CLAIM_QUERY_RAISED', 'CLAIM_RESPONDED', 'CLAIM_UNDER_REVIEW', 'CLAIM_APPROVED', 'CLAIM_PARTIALLY_APPROVED', 'CLAIM_REJECTED', 'CLAIM_DEDUCTED', 'CLAIM_PAID', 'CLAIM_CLOSED', 'CLAIM_RESUBMITTED');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('FINAL', 'INTERIM', 'ENHANCEMENT');

-- CreateEnum
CREATE TYPE "DeductionCategory" AS ENUM ('NON_PAYABLE', 'EXCESS', 'COPAY', 'DEDUCTIBLE', 'NON_MEDICAL', 'TARIFF_DIFF', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('HCX', 'NHCX', 'DIRECT_API', 'SFTP_BATCH', 'PORTAL_ASSISTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "GatewayTxType" AS ENUM ('PREAUTH_SUBMIT', 'PREAUTH_STATUS', 'CLAIM_SUBMIT', 'CLAIM_STATUS', 'COVERAGE_CHECK', 'PAYMENT_NOTICE', 'WEBHOOK_INBOUND');

-- CreateEnum
CREATE TYPE "GatewayTxStatus" AS ENUM ('GATEWAY_QUEUED', 'GATEWAY_SENT', 'GATEWAY_ACK_RECEIVED', 'GATEWAY_RESPONSE_RECEIVED', 'GATEWAY_FAILED', 'GATEWAY_TIMED_OUT');

-- CreateEnum
CREATE TYPE "InsuranceDocRole" AS ENUM ('PREAUTH_FORM', 'DISCHARGE_SUMMARY', 'INVESTIGATION_REPORT', 'PRESCRIPTION', 'BILL_SUMMARY', 'CLAIM_FORM', 'ID_PROOF', 'INSURANCE_CARD', 'QUERY_RESPONSE', 'ENHANCEMENT_FORM', 'DOC_OTHER');

-- CreateEnum
CREATE TYPE "InsuranceDocEntityType" AS ENUM ('INSURANCE_CASE', 'PREAUTH', 'CLAIM', 'PATIENT_POLICY');

-- CreateEnum
CREATE TYPE "PaymentAdviceStatus" AS ENUM ('PA_RECEIVED', 'PA_RECONCILED', 'PA_DISPUTED', 'PA_PARTIAL');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('NEFT', 'RTGS', 'CHEQUE', 'UPI', 'CASH_PAYMENT', 'OTHER_MODE');

-- CreateTable
CREATE TABLE "PatientInsurancePolicy" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "contractId" TEXT,
    "policyNumber" VARCHAR(64) NOT NULL,
    "memberId" VARCHAR(64) NOT NULL,
    "groupId" VARCHAR(64),
    "employerName" VARCHAR(160),
    "planName" VARCHAR(160),
    "relationship" "PolicyRelationship" NOT NULL DEFAULT 'SELF',
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "sumInsured" DECIMAL(14,2),
    "balanceRemaining" DECIMAL(14,2),
    "cardNumber" VARCHAR(64),
    "cardImageUrl" VARCHAR(500),
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientInsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceCase" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "caseNumber" VARCHAR(48) NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "admissionId" TEXT,
    "policyId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "contractId" TEXT,
    "schemeConfigId" TEXT,
    "caseType" "InsuranceCaseType" NOT NULL DEFAULT 'CASHLESS',
    "status" "InsuranceCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "treatingDoctorId" TEXT,
    "primaryDiagnosis" TEXT,
    "procedures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "packageCode" VARCHAR(48),
    "packageName" VARCHAR(160),
    "estimatedAmount" DECIMAL(14,2),
    "approvedAmount" DECIMAL(14,2),
    "claimedAmount" DECIMAL(14,2),
    "settledAmount" DECIMAL(14,2),
    "assignedToUserId" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreauthRequest" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "insuranceCaseId" TEXT NOT NULL,
    "requestNumber" VARCHAR(48) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "PreauthStatus" NOT NULL DEFAULT 'PREAUTH_DRAFT',
    "requestedAmount" DECIMAL(14,2),
    "approvedAmount" DECIMAL(14,2),
    "packageCode" VARCHAR(48),
    "procedureSummary" TEXT,
    "clinicalNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "validTill" TIMESTAMP(3),
    "enhancementAmount" DECIMAL(14,2),
    "enhancementReason" TEXT,
    "gatewayRefId" VARCHAR(128),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreauthRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreauthQuery" (
    "id" TEXT NOT NULL,
    "preauthId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "querySource" "PreauthQuerySource" NOT NULL,
    "queriedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queriedByUserId" TEXT,
    "responseText" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedByUserId" TEXT,
    "deadline" TIMESTAMP(3),
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreauthQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "insuranceCaseId" TEXT NOT NULL,
    "claimNumber" VARCHAR(48) NOT NULL,
    "claimType" "ClaimType" NOT NULL DEFAULT 'FINAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ClaimStatus" NOT NULL DEFAULT 'CLAIM_DRAFT',
    "totalAmount" DECIMAL(14,2),
    "approvedAmount" DECIMAL(14,2),
    "deductedAmount" DECIMAL(14,2),
    "paidAmount" DECIMAL(14,2),
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "gatewayRefId" VARCHAR(128),
    "resubmissionOfId" TEXT,
    "notes" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimLineItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "serviceItemId" TEXT,
    "chargeMasterItemId" TEXT,
    "description" VARCHAR(240) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "approvedQuantity" INTEGER,
    "approvedUnitPrice" DECIMAL(12,2),
    "approvedTotal" DECIMAL(12,2),
    "deniedAmount" DECIMAL(12,2),
    "denialReasonCode" VARCHAR(48),
    "denialNotes" TEXT,
    "packageCode" VARCHAR(48),
    "hsnSac" VARCHAR(16),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimDeduction" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "reasonCode" VARCHAR(48) NOT NULL,
    "reasonCategory" "DeductionCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isDisputed" BOOLEAN NOT NULL DEFAULT false,
    "disputeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimVersion" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "changeReason" TEXT,

    CONSTRAINT "ClaimVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceDocument" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "fileUrl" VARCHAR(500) NOT NULL,
    "fileMime" VARCHAR(128),
    "fileSizeBytes" INTEGER,
    "checksum" VARCHAR(128),
    "docRole" "InsuranceDocRole" NOT NULL DEFAULT 'DOC_OTHER',
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceDocumentLink" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "entityType" "InsuranceDocEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "insuranceCaseId" TEXT,
    "preauthRequestId" TEXT,
    "claimId" TEXT,
    "policyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceDocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayerIntegrationConfig" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "integrationMode" "IntegrationMode" NOT NULL DEFAULT 'MANUAL',
    "hcxParticipantCode" VARCHAR(128),
    "hcxEndpointUrl" VARCHAR(500),
    "hcxAuthConfig" JSONB,
    "apiBaseUrl" VARCHAR(500),
    "apiAuthMethod" VARCHAR(32),
    "apiAuthConfig" JSONB,
    "sftpHost" VARCHAR(256),
    "sftpPort" INTEGER,
    "sftpPath" VARCHAR(256),
    "sftpAuthConfig" JSONB,
    "portalUrl" VARCHAR(500),
    "portalNotes" TEXT,
    "webhookSecret" VARCHAR(256),
    "webhookUrl" VARCHAR(500),
    "retryMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryBackoffMs" INTEGER NOT NULL DEFAULT 5000,
    "pollingIntervalMs" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayerIntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAdvice" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "adviceNumber" VARCHAR(64),
    "utrNumber" VARCHAR(64),
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'NEFT',
    "status" "PaymentAdviceStatus" NOT NULL DEFAULT 'PA_RECEIVED',
    "bankReference" VARCHAR(128),
    "shortPaymentReason" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledByUserId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAdvice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayTransaction" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "payerIntegrationConfigId" TEXT NOT NULL,
    "txType" "GatewayTxType" NOT NULL,
    "txStatus" "GatewayTxStatus" NOT NULL DEFAULT 'GATEWAY_QUEUED',
    "entityType" VARCHAR(32) NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "externalRefId" VARCHAR(128),
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientInsurancePolicy_branchId_patientId_idx" ON "PatientInsurancePolicy"("branchId", "patientId");

-- CreateIndex
CREATE INDEX "PatientInsurancePolicy_branchId_payerId_status_idx" ON "PatientInsurancePolicy"("branchId", "payerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientInsurancePolicy_branchId_patientId_payerId_policyNum_key" ON "PatientInsurancePolicy"("branchId", "patientId", "payerId", "policyNumber");

-- CreateIndex
CREATE INDEX "InsuranceCase_branchId_status_idx" ON "InsuranceCase"("branchId", "status");

-- CreateIndex
CREATE INDEX "InsuranceCase_branchId_patientId_idx" ON "InsuranceCase"("branchId", "patientId");

-- CreateIndex
CREATE INDEX "InsuranceCase_branchId_payerId_status_idx" ON "InsuranceCase"("branchId", "payerId", "status");

-- CreateIndex
CREATE INDEX "InsuranceCase_branchId_encounterId_idx" ON "InsuranceCase"("branchId", "encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceCase_branchId_caseNumber_key" ON "InsuranceCase"("branchId", "caseNumber");

-- CreateIndex
CREATE INDEX "PreauthRequest_insuranceCaseId_status_idx" ON "PreauthRequest"("insuranceCaseId", "status");

-- CreateIndex
CREATE INDEX "PreauthRequest_branchId_status_idx" ON "PreauthRequest"("branchId", "status");

-- CreateIndex
CREATE INDEX "PreauthQuery_preauthId_queriedAt_idx" ON "PreauthQuery"("preauthId", "queriedAt");

-- CreateIndex
CREATE INDEX "Claim_insuranceCaseId_status_idx" ON "Claim"("insuranceCaseId", "status");

-- CreateIndex
CREATE INDEX "Claim_branchId_status_idx" ON "Claim"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_branchId_claimNumber_key" ON "Claim"("branchId", "claimNumber");

-- CreateIndex
CREATE INDEX "ClaimLineItem_claimId_idx" ON "ClaimLineItem"("claimId");

-- CreateIndex
CREATE INDEX "ClaimDeduction_claimId_idx" ON "ClaimDeduction"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimVersion_claimId_versionNumber_key" ON "ClaimVersion"("claimId", "versionNumber");

-- CreateIndex
CREATE INDEX "InsuranceDocument_branchId_docRole_idx" ON "InsuranceDocument"("branchId", "docRole");

-- CreateIndex
CREATE INDEX "InsuranceDocumentLink_entityType_entityId_idx" ON "InsuranceDocumentLink"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceDocumentLink_documentId_entityType_entityId_key" ON "InsuranceDocumentLink"("documentId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "PayerIntegrationConfig_branchId_integrationMode_isActive_idx" ON "PayerIntegrationConfig"("branchId", "integrationMode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PayerIntegrationConfig_branchId_payerId_key" ON "PayerIntegrationConfig"("branchId", "payerId");

-- CreateIndex
CREATE INDEX "PaymentAdvice_claimId_idx" ON "PaymentAdvice"("claimId");

-- CreateIndex
CREATE INDEX "PaymentAdvice_branchId_paymentDate_idx" ON "PaymentAdvice"("branchId", "paymentDate");

-- CreateIndex
CREATE INDEX "GatewayTransaction_entityType_entityId_idx" ON "GatewayTransaction"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "GatewayTransaction_txStatus_nextRetryAt_idx" ON "GatewayTransaction"("txStatus", "nextRetryAt");

-- CreateIndex
CREATE INDEX "GatewayTransaction_branchId_txType_idx" ON "GatewayTransaction"("branchId", "txType");

-- AddForeignKey
ALTER TABLE "PatientInsurancePolicy" ADD CONSTRAINT "PatientInsurancePolicy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurancePolicy" ADD CONSTRAINT "PatientInsurancePolicy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurancePolicy" ADD CONSTRAINT "PatientInsurancePolicy_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurancePolicy" ADD CONSTRAINT "PatientInsurancePolicy_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "PayerContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurancePolicy" ADD CONSTRAINT "PatientInsurancePolicy_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PatientInsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "PayerContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_schemeConfigId_fkey" FOREIGN KEY ("schemeConfigId") REFERENCES "GovernmentSchemeConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_treatingDoctorId_fkey" FOREIGN KEY ("treatingDoctorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreauthRequest" ADD CONSTRAINT "PreauthRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreauthRequest" ADD CONSTRAINT "PreauthRequest_insuranceCaseId_fkey" FOREIGN KEY ("insuranceCaseId") REFERENCES "InsuranceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreauthRequest" ADD CONSTRAINT "PreauthRequest_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreauthQuery" ADD CONSTRAINT "PreauthQuery_preauthId_fkey" FOREIGN KEY ("preauthId") REFERENCES "PreauthRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreauthQuery" ADD CONSTRAINT "PreauthQuery_queriedByUserId_fkey" FOREIGN KEY ("queriedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreauthQuery" ADD CONSTRAINT "PreauthQuery_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_insuranceCaseId_fkey" FOREIGN KEY ("insuranceCaseId") REFERENCES "InsuranceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_resubmissionOfId_fkey" FOREIGN KEY ("resubmissionOfId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLineItem" ADD CONSTRAINT "ClaimLineItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLineItem" ADD CONSTRAINT "ClaimLineItem_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLineItem" ADD CONSTRAINT "ClaimLineItem_chargeMasterItemId_fkey" FOREIGN KEY ("chargeMasterItemId") REFERENCES "ChargeMasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimDeduction" ADD CONSTRAINT "ClaimDeduction_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimVersion" ADD CONSTRAINT "ClaimVersion_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimVersion" ADD CONSTRAINT "ClaimVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDocument" ADD CONSTRAINT "InsuranceDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDocument" ADD CONSTRAINT "InsuranceDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDocument" ADD CONSTRAINT "InsuranceDocument_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDocumentLink" ADD CONSTRAINT "InsuranceDocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "InsuranceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDocumentLink" ADD CONSTRAINT "InsuranceDocumentLink_insuranceCaseId_fkey" FOREIGN KEY ("insuranceCaseId") REFERENCES "InsuranceCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDocumentLink" ADD CONSTRAINT "InsuranceDocumentLink_preauthRequestId_fkey" FOREIGN KEY ("preauthRequestId") REFERENCES "PreauthRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDocumentLink" ADD CONSTRAINT "InsuranceDocumentLink_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDocumentLink" ADD CONSTRAINT "InsuranceDocumentLink_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PatientInsurancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerIntegrationConfig" ADD CONSTRAINT "PayerIntegrationConfig_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerIntegrationConfig" ADD CONSTRAINT "PayerIntegrationConfig_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdvice" ADD CONSTRAINT "PaymentAdvice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdvice" ADD CONSTRAINT "PaymentAdvice_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdvice" ADD CONSTRAINT "PaymentAdvice_reconciledByUserId_fkey" FOREIGN KEY ("reconciledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayTransaction" ADD CONSTRAINT "GatewayTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayTransaction" ADD CONSTRAINT "GatewayTransaction_payerIntegrationConfigId_fkey" FOREIGN KEY ("payerIntegrationConfigId") REFERENCES "PayerIntegrationConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
