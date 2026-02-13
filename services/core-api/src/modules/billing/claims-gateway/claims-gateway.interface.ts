// ---------------------------------------------------------------------------
// Claims Gateway — adapter interface & shared types
// ---------------------------------------------------------------------------

export interface PreauthSubmission {
  preauthId: string;
  insuranceCaseId: string;
  patientName: string;
  policyNumber: string;
  memberId: string;
  payerCode: string;
  requestedAmount: number;
  packageCode?: string;
  procedureSummary?: string;
  clinicalNotes?: string;
  documents?: Array<{ url: string; role: string }>;
}

export interface ClaimSubmission {
  claimId: string;
  insuranceCaseId: string;
  claimNumber: string;
  claimType: string;
  patientName: string;
  policyNumber: string;
  memberId: string;
  payerCode: string;
  totalAmount: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    hsnSac?: string;
  }>;
  documents?: Array<{ url: string; role: string }>;
}

export interface GatewayResponse {
  success: boolean;
  externalRefId?: string;
  message?: string;
  rawResponse?: any;
}

export interface StatusResponse {
  status: string;
  message?: string;
  approvedAmount?: number;
  rejectionReason?: string;
  deductions?: Array<{ code: string; amount: number; reason: string }>;
  rawResponse?: any;
}

export interface CoverageCheckRequest {
  policyNumber: string;
  memberId: string;
  payerCode: string;
  serviceCode?: string;
}

export interface CoverageCheckResponse {
  isEligible: boolean;
  remainingBalance?: number;
  message?: string;
  rawResponse?: any;
}

export interface IClaimsGatewayAdapter {
  readonly mode: string;
  submitPreauth(req: PreauthSubmission): Promise<GatewayResponse>;
  getPreauthStatus(refId: string): Promise<StatusResponse>;
  submitClaim(req: ClaimSubmission): Promise<GatewayResponse>;
  getClaimStatus(refId: string): Promise<StatusResponse>;
  checkCoverage(req: CoverageCheckRequest): Promise<CoverageCheckResponse>;
}
