# ZypoCare HIMS - Staff Management & Credentials Workflow
# Complete Human Resources & Compliance System

**Document Version:** 1.0  
**Date:** February 6, 2026  
**Module:** Staff Management & Credentials  
**Reference:** ZypoCare Unified BRD v2.0

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Data Model & Relationships](#2-data-model--relationships)
3. [Staff Onboarding Workflow](#3-staff-onboarding-workflow)
4. [Credential Management Workflow](#4-credential-management-workflow)
5. [Privilege Management (Doctors)](#5-privilege-management-doctors)
6. [Compliance & Verification](#6-compliance--verification)
7. [Staff Scheduling & Rostering](#7-staff-scheduling--rostering)
8. [Training & Competency](#8-training--competency)
9. [Performance & Appraisal](#9-performance--appraisal)
10. [Staff Separation](#10-staff-separation)
11. [Integration Points](#11-integration-points)
12. [Business Rules & Validations](#12-business-rules--validations)
13. [User Roles & Permissions](#13-user-roles--permissions)
14. [API Specifications](#14-api-specifications)
15. [UI/UX Flow](#15-uiux-flow)
16. [Compliance Checklist](#16-compliance-checklist)

---

## 1. System Overview

### 1.1 Purpose
The Staff Management & Credentials module provides comprehensive human resource management for hospitals, covering recruitment to retirement with full compliance tracking for Indian healthcare regulations (MCI, Nursing Council, Pharmacy Council, ABDM HPR, NABH).

### 1.2 Key Components

```
┌─────────────────────────────────────────────────────────────────┐
│              STAFF MANAGEMENT & CREDENTIALS SYSTEM               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   STAFF      │  │  CREDENTIALS │  │  PRIVILEGES  │          │
│  │   PROFILES   │──│  & LICENSES  │──│ (Doctors)    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         │                 │                 │                   │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐          │
│  │  SCHEDULING  │  │   TRAINING   │  │  COMPLIANCE  │          │
│  │  & ROSTERING │  │ & COMPETENCY │  │  TRACKING    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  ATTENDANCE  │  │  PERFORMANCE │  │   EMPLOYEE   │          │
│  │  & LEAVES    │  │  & APPRAISAL │  │   HEALTH     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Scope

**In Scope:**
- Staff profile management (clinical & non-clinical)
- Credential tracking with auto-expiry alerts
- Professional license verification
- ABDM HPR integration
- Clinical privileges management (doctors)
- Department & specialty assignment
- Scheduling & rostering
- Attendance & leave management
- Training & competency tracking
- Performance appraisal
- Employee health & vaccination records
- Background verification tracking
- Insurance & indemnity tracking
- NABH Chapter 9 compliance
- Exit management

**Out of Scope (Handled by External Systems):**
- Payroll processing (integration points provided)
- Recruitment & hiring process
- Tax calculations
- PF/ESI contributions

---

## 2. Data Model & Relationships

### 2.1 Core Entities

#### 2.1.1 Staff Master

```typescript
interface Staff {
  // Basic Information
  id: string;                          // UUID
  branchId: string;                    // FK to Branch
  employeeCode: string;                // Unique employee ID
  
  // Personal Details
  title: Title;                        // Dr., Mr., Ms., Mrs.
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName: string;                 // Computed
  dateOfBirth: Date;
  gender: Gender;
  bloodGroup?: BloodGroup;
  maritalStatus?: MaritalStatus;
  
  // Contact Information
  primaryPhone: string;
  secondaryPhone?: string;
  personalEmail: string;
  officialEmail?: string;
  emergencyContact: EmergencyContact;
  
  // Current Address
  currentAddress: Address;
  
  // Permanent Address
  permanentAddress: Address;
  isSameAsCurrent: boolean;
  
  // Identity Documents
  identityProof: IdentityDocument[];   // Aadhar, PAN, Passport, DL
  
  // Professional Details
  staffCategory: StaffCategory;        // CLINICAL, NON_CLINICAL
  staffType: StaffType;                // DOCTOR, NURSE, TECHNICIAN, etc.
  designation: string;
  department: string;                  // FK to Department
  reportingTo?: string;                // FK to Staff (supervisor)
  
  // Specialties (for clinical staff)
  primarySpecialty?: string;           // FK to Specialty
  secondarySpecialties?: string[];     // FK to Specialty[]
  
  // Employment Details
  employmentType: EmploymentType;      // PERMANENT, CONTRACT, CONSULTANT, INTERN, etc.
  employmentStatus: EmploymentStatus;  // ACTIVE, ON_LEAVE, SUSPENDED, RESIGNED, etc.
  joiningDate: Date;
  confirmationDate?: Date;
  probationEndDate?: Date;
  contractStartDate?: Date;
  contractEndDate?: Date;
  
  // Shift & Scheduling
  defaultShiftType?: ShiftType;        // MORNING, EVENING, NIGHT, ROTATIONAL
  isFullTime: boolean;
  workingHoursPerWeek: number;
  weeklyOffDays: DayOfWeek[];
  
  // System Access
  userId?: string;                     // FK to User (for system login)
  hasSystemAccess: boolean;
  
  // Financial
  salaryGrade?: string;
  bankDetails?: BankDetails;
  
  // Status & Flags
  isActive: boolean;
  isAvailableForAppointment: boolean;  // For doctors
  isAvailableForDuty: boolean;
  canPrescribe: boolean;               // For doctors/consultants
  canAdmitPatients: boolean;           // For doctors
  canPerformSurgery: boolean;          // For surgeons
  
  // Photograph & Signature
  photographUrl?: string;
  signatureUrl?: string;
  
  // ABDM Integration
  hprId?: string;                      // Health Professional Registry ID
  hprVerificationStatus?: VerificationStatus;
  hprLastVerifiedDate?: Date;
  
  // Background Verification
  backgroundVerification?: BackgroundVerification;
  policeVerification?: PoliceVerification;
  
  // Exit Details (if separated)
  separationDate?: Date;
  separationReason?: string;
  separationType?: SeparationType;     // RESIGNATION, TERMINATION, RETIREMENT
  exitInterviewCompleted?: boolean;
  fullAndFinalSettlement?: boolean;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  lastActiveDate?: Date;
}

enum StaffCategory {
  CLINICAL = 'CLINICAL',
  NON_CLINICAL = 'NON_CLINICAL'
}

enum StaffType {
  // Clinical
  DOCTOR_CONSULTANT = 'DOCTOR_CONSULTANT',
  DOCTOR_RESIDENT = 'DOCTOR_RESIDENT',
  DOCTOR_INTERN = 'DOCTOR_INTERN',
  NURSE_HEAD = 'NURSE_HEAD',
  NURSE_STAFF = 'NURSE_STAFF',
  NURSE_TRAINEE = 'NURSE_TRAINEE',
  TECHNICIAN_LAB = 'TECHNICIAN_LAB',
  TECHNICIAN_RADIOLOGY = 'TECHNICIAN_RADIOLOGY',
  TECHNICIAN_OT = 'TECHNICIAN_OT',
  TECHNICIAN_DIALYSIS = 'TECHNICIAN_DIALYSIS',
  TECHNICIAN_ANESTHESIA = 'TECHNICIAN_ANESTHESIA',
  PHARMACIST = 'PHARMACIST',
  PHARMACIST_ASSISTANT = 'PHARMACIST_ASSISTANT',
  PHYSIOTHERAPIST = 'PHYSIOTHERAPIST',
  DIETITIAN = 'DIETITIAN',
  COUNSELOR = 'COUNSELOR',
  PARAMEDIC = 'PARAMEDIC',
  WARD_BOY = 'WARD_BOY',
  NURSING_AIDE = 'NURSING_AIDE',
  
  // Non-Clinical
  ADMIN_OFFICER = 'ADMIN_OFFICER',
  BILLING_EXECUTIVE = 'BILLING_EXECUTIVE',
  RECEPTIONIST = 'RECEPTIONIST',
  MEDICAL_RECORDS_OFFICER = 'MEDICAL_RECORDS_OFFICER',
  IT_SUPPORT = 'IT_SUPPORT',
  SECURITY_GUARD = 'SECURITY_GUARD',
  HOUSEKEEPING = 'HOUSEKEEPING',
  MAINTENANCE_ENGINEER = 'MAINTENANCE_ENGINEER',
  DRIVER = 'DRIVER',
  COOK = 'COOK',
  LAUNDRY_STAFF = 'LAUNDRY_STAFF',
  BIOMEDICAL_ENGINEER = 'BIOMEDICAL_ENGINEER'
}

enum EmploymentType {
  PERMANENT = 'PERMANENT',
  CONTRACT = 'CONTRACT',
  CONSULTANT = 'CONSULTANT',
  VISITING = 'VISITING',
  INTERN = 'INTERN',
  TRAINEE = 'TRAINEE',
  PART_TIME = 'PART_TIME',
  TEMPORARY = 'TEMPORARY',
  ON_CALL = 'ON_CALL'
}

enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  ON_PROBATION = 'ON_PROBATION',
  ON_LEAVE = 'ON_LEAVE',
  ON_NOTICE = 'ON_NOTICE',
  SUSPENDED = 'SUSPENDED',
  RESIGNED = 'RESIGNED',
  TERMINATED = 'TERMINATED',
  RETIRED = 'RETIRED',
  ABSCONDED = 'ABSCONDED',
  DECEASED = 'DECEASED'
}

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY'
}

enum MaritalStatus {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED'
}

interface EmergencyContact {
  name: string;
  relationship: string;
  primaryPhone: string;
  secondaryPhone?: string;
  address?: string;
}

interface Address {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

interface IdentityDocument {
  documentType: IdentityDocumentType;
  documentNumber: string;
  issuingAuthority?: string;
  issueDate?: Date;
  expiryDate?: Date;
  documentUrl?: string;
  isVerified: boolean;
  verifiedBy?: string;
  verificationDate?: Date;
}

enum IdentityDocumentType {
  AADHAR = 'AADHAR',
  PAN = 'PAN',
  PASSPORT = 'PASSPORT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  VOTER_ID = 'VOTER_ID',
  RATION_CARD = 'RATION_CARD'
}

interface BankDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: 'SAVINGS' | 'CURRENT';
}

interface BackgroundVerification {
  status: VerificationStatus;
  verifiedBy: string;                  // Agency name
  verificationDate: Date;
  reportUrl?: string;
  remarks?: string;
  clearedForEmployment: boolean;
}

interface PoliceVerification {
  status: VerificationStatus;
  policeStation: string;
  applicationNumber?: string;
  applicationDate?: Date;
  verificationDate?: Date;
  certificateUrl?: string;
  expiryDate?: Date;
  remarks?: string;
}

enum VerificationStatus {
  NOT_INITIATED = 'NOT_INITIATED',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}
```

#### 2.1.2 Staff Credentials

```typescript
interface Credential {
  id: string;
  staffId: string;                     // FK to Staff
  
  // Credential Details
  credentialType: CredentialType;
  credentialCategory: CredentialCategory;
  
  // Registration/License Details
  registrationNumber: string;          // e.g., MCI Registration Number
  registrationAuthority: string;       // e.g., "Medical Council of India"
  stateCouncil?: string;               // For state registrations
  
  // Educational Details (for degrees)
  degreeName?: string;                 // e.g., "MBBS", "MD - Cardiology"
  university?: string;
  yearOfPassing?: number;
  
  // Validity
  issueDate: Date;
  expiryDate?: Date;                   // null for lifetime credentials
  isLifetime: boolean;
  
  // Renewal Tracking
  renewalRequired: boolean;
  lastRenewalDate?: Date;
  nextRenewalDate?: Date;
  renewalReminderDays: number[];       // e.g., [90, 60, 30, 15, 7]
  
  // Verification
  verificationStatus: VerificationStatus;
  verifiedBy?: string;                 // Staff ID of verifier
  verificationDate?: Date;
  verificationRemarks?: string;
  
  // ABDM HPR Verification (for doctors)
  isHprVerified: boolean;
  hprVerificationDate?: Date;
  hprVerificationResponse?: any;       // HPR API response
  
  // Documents
  certificateUrl?: string;             // Scanned certificate
  supportingDocuments?: string[];      // Additional documents
  
  // Status
  status: CredentialStatus;
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

enum CredentialType {
  // Medical Degrees
  MBBS = 'MBBS',
  BDS = 'BDS',
  BAMS = 'BAMS',
  BHMS = 'BHMS',
  BUMS = 'BUMS',
  MD = 'MD',
  MS = 'MS',
  DNB = 'DNB',
  DM = 'DM',
  MCh = 'MCh',
  DIPLOMA = 'DIPLOMA',
  
  // Medical Registration
  MCI_REGISTRATION = 'MCI_REGISTRATION',
  STATE_MEDICAL_REGISTRATION = 'STATE_MEDICAL_REGISTRATION',
  
  // Nursing
  GNM = 'GNM',                         // General Nursing & Midwifery
  BSC_NURSING = 'BSC_NURSING',
  MSC_NURSING = 'MSC_NURSING',
  POST_BASIC_BSC_NURSING = 'POST_BASIC_BSC_NURSING',
  NURSING_COUNCIL_REGISTRATION = 'NURSING_COUNCIL_REGISTRATION',
  
  // Pharmacy
  D_PHARM = 'D_PHARM',
  B_PHARM = 'B_PHARM',
  M_PHARM = 'M_PHARM',
  PHARM_D = 'PHARM_D',
  PHARMACY_COUNCIL_REGISTRATION = 'PHARMACY_COUNCIL_REGISTRATION',
  DRUG_LICENSE = 'DRUG_LICENSE',       // For pharmacist in-charge
  
  // Laboratory
  DMLT = 'DMLT',                       // Diploma in Medical Lab Technology
  BMLT = 'BMLT',                       // Bachelor in Medical Lab Technology
  BSC_MLT = 'BSC_MLT',
  MSC_MLT = 'MSC_MLT',
  
  // Radiology
  DMRT = 'DMRT',                       // Diploma in Medical Radio Therapy
  BSC_RADIOLOGY = 'BSC_RADIOLOGY',
  AERB_LICENSE = 'AERB_LICENSE',       // For radiation workers
  RADIATION_SAFETY_OFFICER = 'RADIATION_SAFETY_OFFICER',
  
  // Physiotherapy
  BPT = 'BPT',
  MPT = 'MPT',
  PHYSIOTHERAPY_COUNCIL_REGISTRATION = 'PHYSIOTHERAPY_COUNCIL_REGISTRATION',
  
  // Dietetics
  BSC_DIETETICS = 'BSC_DIETETICS',
  MSC_DIETETICS = 'MSC_DIETETICS',
  
  // Other Certifications
  BLS = 'BLS',                         // Basic Life Support
  ACLS = 'ACLS',                       // Advanced Cardiac Life Support
  PALS = 'PALS',                       // Pediatric Advanced Life Support
  ATLS = 'ATLS',                       // Advanced Trauma Life Support
  NRP = 'NRP',                         // Neonatal Resuscitation Program
  
  // Infection Control
  INFECTION_CONTROL_CERTIFICATION = 'INFECTION_CONTROL_CERTIFICATION',
  
  // Fire Safety
  FIRE_SAFETY_TRAINING = 'FIRE_SAFETY_TRAINING',
  
  // NABH
  NABH_ORIENTATION = 'NABH_ORIENTATION',
  
  // Other
  OTHER = 'OTHER'
}

enum CredentialCategory {
  EDUCATIONAL_DEGREE = 'EDUCATIONAL_DEGREE',
  PROFESSIONAL_REGISTRATION = 'PROFESSIONAL_REGISTRATION',
  SPECIALIZATION = 'SPECIALIZATION',
  CERTIFICATION = 'CERTIFICATION',
  LICENSE = 'LICENSE',
  TRAINING = 'TRAINING'
}

enum CredentialStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  EXPIRING_SOON = 'EXPIRING_SOON',     // Within reminder window
  RENEWAL_IN_PROGRESS = 'RENEWAL_IN_PROGRESS',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}
```

#### 2.1.3 Clinical Privileges (Doctors)

```typescript
interface ClinicalPrivilege {
  id: string;
  staffId: string;                     // FK to Staff (must be doctor)
  
  // Privilege Details
  privilegeType: PrivilegeType;
  privilegeName: string;
  privilegeDescription?: string;
  
  // Scope
  departments: string[];               // FK to Department[]
  specialties: string[];               // FK to Specialty[]
  procedures: string[];                // FK to Procedure[] (specific procedures authorized)
  
  // Authorization
  grantedBy: string;                   // FK to Staff (authorizing physician/admin)
  grantedByRole: string;               // Role of grantor
  grantedDate: Date;
  
  // Validity
  effectiveDate: Date;
  expiryDate?: Date;                   // null for indefinite
  isLifetime: boolean;
  
  // Review Cycle
  reviewRequired: boolean;
  reviewCycle: ReviewCycle;            // MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL
  lastReviewDate?: Date;
  nextReviewDate?: Date;
  reviewedBy?: string;
  reviewRemarks?: string;
  
  // Conditions & Restrictions
  conditions?: string[];               // e.g., "Under supervision for first 10 cases"
  restrictions?: string[];             // e.g., "Not for pediatric patients"
  supervisionRequired: boolean;
  supervisorId?: string;               // FK to Staff (if supervision required)
  
  // Competency Assessment
  competencyAssessmentRequired: boolean;
  lastAssessmentDate?: Date;
  assessmentScore?: number;
  assessorId?: string;
  
  // Case Volume Tracking (for monitoring competency)
  minimumCaseVolume?: number;          // per review period
  currentCaseVolume?: number;
  
  // Status
  status: PrivilegeStatus;
  isActive: boolean;
  
  // Supporting Documents
  credentialDocuments?: string[];      // Links to supporting credentials
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

enum PrivilegeType {
  ADMITTING = 'ADMITTING',             // Can admit patients
  SURGICAL = 'SURGICAL',               // Can perform surgeries
  ANESTHESIA = 'ANESTHESIA',           // Can administer anesthesia
  PRESCRIPTION = 'PRESCRIPTION',       // Can prescribe medications
  PROCEDURE = 'PROCEDURE',             // Can perform specific procedures
  SUPERVISION = 'SUPERVISION',         // Can supervise juniors
  TEACHING = 'TEACHING',               // Can train residents/students
  TELEMEDICINE = 'TELEMEDICINE',       // Can provide teleconsultation
  EMERGENCY = 'EMERGENCY',             // Can handle emergency cases
  ICU = 'ICU',                         // Can manage ICU patients
  NICU = 'NICU',                       // Can manage NICU patients
  HIGH_RISK_OB = 'HIGH_RISK_OB',       // High-risk obstetrics
  INTERVENTIONAL = 'INTERVENTIONAL',   // Interventional procedures
  ENDOSCOPY = 'ENDOSCOPY',             // Endoscopic procedures
  DIAGNOSTIC = 'DIAGNOSTIC',           // Diagnostic procedures
  PAIN_MANAGEMENT = 'PAIN_MANAGEMENT'
}

enum ReviewCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  ANNUAL = 'ANNUAL',
  BIENNIAL = 'BIENNIAL'
}

enum PrivilegeStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PROVISIONAL = 'PROVISIONAL'          // Temporary privilege
}

// Privilege Procedure Mapping
interface PrivilegeProcedure {
  id: string;
  privilegeId: string;                 // FK to ClinicalPrivilege
  procedureCode: string;               // CPT/ICD-10-PCS code
  procedureName: string;
  complexity: ProcedureComplexity;
  supervisionRequired: boolean;
  casesPerformed?: number;             // Track volume
  createdAt: Date;
}

enum ProcedureComplexity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH'
}
```

#### 2.1.4 Staff Department Assignment

```typescript
interface StaffDepartmentAssignment {
  id: string;
  staffId: string;                     // FK to Staff
  departmentId: string;                // FK to Department
  
  // Assignment Details
  isPrimary: boolean;                  // Primary department
  role: DepartmentRole;                // Role in this department
  
  // Allocation
  workloadPercentage: number;          // % of time allocated to this dept
  expectedHoursPerWeek?: number;
  
  // Authorization Level
  isHeadOfDepartment: boolean;
  canApproveOrders: boolean;
  canApproveLeaves: boolean;
  canAccessRecords: boolean;
  
  // Validity
  effectiveDate: Date;
  endDate?: Date;                      // null for indefinite
  
  // Status
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

enum DepartmentRole {
  HEAD = 'HEAD',
  SENIOR_CONSULTANT = 'SENIOR_CONSULTANT',
  CONSULTANT = 'CONSULTANT',
  SENIOR_RESIDENT = 'SENIOR_RESIDENT',
  JUNIOR_RESIDENT = 'JUNIOR_RESIDENT',
  INTERN = 'INTERN',
  CHIEF_NURSE = 'CHIEF_NURSE',
  SENIOR_NURSE = 'SENIOR_NURSE',
  STAFF_NURSE = 'STAFF_NURSE',
  TECHNICIAN_LEAD = 'TECHNICIAN_LEAD',
  TECHNICIAN = 'TECHNICIAN',
  ASSISTANT = 'ASSISTANT',
  OTHER = 'OTHER'
}
```

#### 2.1.5 Staff Training & Competency

```typescript
interface Training {
  id: string;
  
  // Training Details
  trainingCode: string;
  trainingName: string;
  trainingType: TrainingType;
  trainingCategory: TrainingCategory;
  description?: string;
  
  // Provider
  conductedBy: string;                 // Internal/External organization
  trainerName?: string;
  
  // Content
  syllabus?: string;
  learningObjectives?: string[];
  
  // Duration
  durationHours: number;
  validityPeriod?: number;             // In months (for certifications)
  
  // Mandatory Flags
  isMandatory: boolean;
  mandatoryFor?: StaffType[];          // Staff types for which it's mandatory
  
  // NABH Requirement
  isNabhRequired: boolean;
  nabhChapter?: string;
  
  // Assessment
  hasAssessment: boolean;
  passingScore?: number;
  
  // Status
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

enum TrainingType {
  ORIENTATION = 'ORIENTATION',
  INDUCTION = 'INDUCTION',
  ON_THE_JOB = 'ON_THE_JOB',
  CLASSROOM = 'CLASSROOM',
  ONLINE = 'ONLINE',
  WORKSHOP = 'WORKSHOP',
  SEMINAR = 'SEMINAR',
  CONFERENCE = 'CONFERENCE',
  CERTIFICATION = 'CERTIFICATION',
  REFRESHER = 'REFRESHER',
  CME = 'CME'                          // Continuing Medical Education
}

enum TrainingCategory {
  CLINICAL_SKILLS = 'CLINICAL_SKILLS',
  SOFT_SKILLS = 'SOFT_SKILLS',
  COMPLIANCE = 'COMPLIANCE',
  SAFETY = 'SAFETY',
  INFECTION_CONTROL = 'INFECTION_CONTROL',
  FIRE_SAFETY = 'FIRE_SAFETY',
  BIOMEDICAL_WASTE = 'BIOMEDICAL_WASTE',
  PATIENT_RIGHTS = 'PATIENT_RIGHTS',
  NABH_STANDARDS = 'NABH_STANDARDS',
  IT_SYSTEMS = 'IT_SYSTEMS',
  EMERGENCY_RESPONSE = 'EMERGENCY_RESPONSE',
  QUALITY_IMPROVEMENT = 'QUALITY_IMPROVEMENT',
  COMMUNICATION = 'COMMUNICATION',
  LEADERSHIP = 'LEADERSHIP',
  TECHNICAL = 'TECHNICAL',
  OTHER = 'OTHER'
}

interface StaffTrainingRecord {
  id: string;
  staffId: string;                     // FK to Staff
  trainingId: string;                  // FK to Training
  
  // Attendance
  trainingDate: Date;
  attendanceStatus: AttendanceStatus;
  hoursAttended: number;
  
  // Assessment
  assessmentTaken: boolean;
  assessmentScore?: number;
  assessmentDate?: Date;
  passed: boolean;
  
  // Certification
  certificateIssued: boolean;
  certificateNumber?: string;
  certificateUrl?: string;
  certificateIssueDate?: Date;
  certificateExpiryDate?: Date;
  
  // Validity
  validFrom: Date;
  validUpto?: Date;                    // For certifications with expiry
  
  // Trainer Feedback
  trainerRemarks?: string;
  
  // Status
  status: TrainingStatus;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  PARTIAL = 'PARTIAL',
  EXCUSED = 'EXCUSED'
}

enum TrainingStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}
```

#### 2.1.6 Employee Health Records

```typescript
interface EmployeeHealthRecord {
  id: string;
  staffId: string;                     // FK to Staff
  
  // Pre-Employment Medical
  preEmploymentMedicalDone: boolean;
  preEmploymentMedicalDate?: Date;
  preEmploymentMedicalReport?: string;
  fitForDuty: boolean;
  medicalRestrictions?: string[];
  
  // Periodic Medical Examination
  lastMedicalCheckupDate?: Date;
  nextMedicalCheckupDue?: Date;
  annualCheckupFrequency: number;      // In months
  
  // Medical History
  chronicConditions?: string[];
  allergies?: string[];
  bloodGroup?: BloodGroup;
  
  // Vaccination Records
  vaccinations: VaccinationRecord[];
  
  // Occupational Exposure
  hasBloodExposureRisk: boolean;
  hasRadiationExposure: boolean;
  hasChemicalExposure: boolean;
  hasBiologicalExposure: boolean;
  
  // Injury/Illness Records
  injuries: OccupationalInjury[];
  
  // Fitness Certificates
  fitnessCertificates: FitnessCertificate[];
  
  // Medical Leave History
  totalMedicalLeaveDays?: number;
  
  // Status
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

interface VaccinationRecord {
  id: string;
  staffId: string;
  
  vaccineType: VaccineType;
  vaccineName: string;
  manufacturer?: string;
  batchNumber?: string;
  
  doseNumber: number;                  // 1, 2, 3, etc.
  totalDoses: number;
  
  administeredDate: Date;
  administeredBy?: string;
  administrationSite?: string;         // Left arm, right arm, etc.
  
  nextDoseDate?: Date;
  
  certificateUrl?: string;
  
  // Adverse Events
  adverseReaction: boolean;
  reactionDetails?: string;
  
  isActive: boolean;
  createdAt: Date;
}

enum VaccineType {
  HEPATITIS_B = 'HEPATITIS_B',
  COVID_19 = 'COVID_19',
  INFLUENZA = 'INFLUENZA',
  TETANUS = 'TETANUS',
  MMR = 'MMR',
  CHICKENPOX = 'CHICKENPOX',
  TYPHOID = 'TYPHOID',
  RABIES = 'RABIES',
  OTHER = 'OTHER'
}

interface OccupationalInjury {
  id: string;
  staffId: string;
  
  incidentDate: Date;
  incidentTime?: string;
  incidentLocation: string;
  
  injuryType: InjuryType;
  injuryDescription: string;
  bodyPartAffected: string;
  
  treatmentGiven: string;
  treatingPhysician?: string;
  
  daysLostDueToInjury: number;
  
  incidentReportFiled: boolean;
  incidentReportNumber?: string;
  incidentReportUrl?: string;
  
  compensationClaimed: boolean;
  compensationAmount?: number;
  
  createdAt: Date;
}

enum InjuryType {
  NEEDLE_STICK = 'NEEDLE_STICK',
  SHARP_INJURY = 'SHARP_INJURY',
  SPLASH_EXPOSURE = 'SPLASH_EXPOSURE',
  SLIP_FALL = 'SLIP_FALL',
  BACK_INJURY = 'BACK_INJURY',
  BURN = 'BURN',
  RADIATION_EXPOSURE = 'RADIATION_EXPOSURE',
  CHEMICAL_EXPOSURE = 'CHEMICAL_EXPOSURE',
  BIOLOGICAL_EXPOSURE = 'BIOLOGICAL_EXPOSURE',
  OTHER = 'OTHER'
}

interface FitnessCertificate {
  id: string;
  staffId: string;
  
  certificateType: 'PRE_EMPLOYMENT' | 'PERIODIC' | 'POST_ILLNESS' | 'POST_INJURY';
  
  examinationDate: Date;
  examiningPhysician: string;
  
  fitForDuty: boolean;
  restrictions?: string[];
  remarks?: string;
  
  validFrom: Date;
  validUpto?: Date;
  
  certificateUrl?: string;
  
  createdAt: Date;
}
```

#### 2.1.7 Staff Insurance & Indemnity

```typescript
interface StaffInsurance {
  id: string;
  staffId: string;                     // FK to Staff
  
  // Insurance Details
  insuranceType: InsuranceType;
  insuranceProvider: string;
  policyNumber: string;
  
  // Coverage
  coverageAmount: number;
  currency: string;
  coverageDetails?: string;
  
  // Validity
  policyStartDate: Date;
  policyEndDate: Date;
  
  // Premium
  premiumAmount?: number;
  premiumFrequency?: PremiumFrequency;
  premiumPaidBy?: 'EMPLOYER' | 'EMPLOYEE' | 'SHARED';
  
  // Documents
  policyDocumentUrl?: string;
  
  // Claims
  claimsMade?: number;
  lastClaimDate?: Date;
  
  // Status
  status: InsuranceStatus;
  isActive: boolean;
  
  // Renewal
  renewalReminderDays: number[];
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

enum InsuranceType {
  PROFESSIONAL_INDEMNITY = 'PROFESSIONAL_INDEMNITY',
  MEDICAL_MALPRACTICE = 'MEDICAL_MALPRACTICE',
  HEALTH_INSURANCE = 'HEALTH_INSURANCE',
  LIFE_INSURANCE = 'LIFE_INSURANCE',
  PERSONAL_ACCIDENT = 'PERSONAL_ACCIDENT',
  GROUP_INSURANCE = 'GROUP_INSURANCE',
  OTHER = 'OTHER'
}

enum PremiumFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  ANNUAL = 'ANNUAL'
}

enum InsuranceStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  LAPSED = 'LAPSED',
  PENDING_RENEWAL = 'PENDING_RENEWAL'
}
```

#### 2.1.8 Staff Scheduling & Attendance

```typescript
interface StaffSchedule {
  id: string;
  staffId: string;                     // FK to Staff
  
  // Schedule Details
  scheduleDate: Date;
  shiftType: ShiftType;
  
  // Timing
  startTime: string;                   // HH:mm
  endTime: string;
  
  // Location
  departmentId?: string;               // FK to Department
  unitId?: string;                     // FK to Unit
  location?: string;                   // Specific location
  
  // Type
  scheduleType: ScheduleType;
  
  // OPD Schedule (for doctors)
  opdSlots?: number;                   // Number of appointment slots
  slotDuration?: number;               // In minutes
  
  // Status
  status: ScheduleStatus;
  
  // Actual Attendance (filled later)
  actualCheckIn?: Date;
  actualCheckOut?: Date;
  hoursWorked?: number;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

enum ShiftType {
  MORNING = 'MORNING',                 // 8 AM - 4 PM
  EVENING = 'EVENING',                 // 4 PM - 12 AM
  NIGHT = 'NIGHT',                     // 12 AM - 8 AM
  GENERAL = 'GENERAL',                 // 9 AM - 6 PM
  ROTATIONAL = 'ROTATIONAL',
  ON_CALL = 'ON_CALL',
  FLEXIBLE = 'FLEXIBLE'
}

enum ScheduleType {
  REGULAR_DUTY = 'REGULAR_DUTY',
  ON_CALL = 'ON_CALL',
  OPD = 'OPD',
  OT = 'OT',
  EMERGENCY = 'EMERGENCY',
  ADMIN = 'ADMIN',
  TRAINING = 'TRAINING',
  CONFERENCE = 'CONFERENCE'
}

enum ScheduleStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  ABSENT = 'ABSENT',
  ON_LEAVE = 'ON_LEAVE',
  CANCELLED = 'CANCELLED',
  SWAPPED = 'SWAPPED'
}

interface StaffAttendance {
  id: string;
  staffId: string;                     // FK to Staff
  scheduleId?: string;                 // FK to StaffSchedule (if scheduled)
  
  // Date & Time
  attendanceDate: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  
  // Location
  checkInLocation?: string;
  checkOutLocation?: string;
  
  // Calculation
  expectedHours: number;
  actualHours?: number;
  overtime?: number;
  lateBy?: number;                     // Minutes
  earlyLeaveBy?: number;               // Minutes
  
  // Status
  attendanceStatus: AttendanceStatusType;
  
  // Approval
  approvedBy?: string;
  approvalDate?: Date;
  approvalRemarks?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

enum AttendanceStatusType {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE',
  LATE = 'LATE',
  EARLY_LEAVE = 'EARLY_LEAVE',
  OVERTIME = 'OVERTIME',
  WEEK_OFF = 'WEEK_OFF',
  HOLIDAY = 'HOLIDAY'
}

interface LeaveRequest {
  id: string;
  staffId: string;                     // FK to Staff
  
  // Leave Details
  leaveType: LeaveType;
  fromDate: Date;
  toDate: Date;
  numberOfDays: number;
  isHalfDay: boolean;
  halfDayPeriod?: 'FIRST_HALF' | 'SECOND_HALF';
  
  // Reason
  reason: string;
  reasonCategory?: LeaveReasonCategory;
  
  // Supporting Documents
  medicalCertificate?: string;
  supportingDocuments?: string[];
  
  // Approval Workflow
  status: LeaveStatus;
  appliedDate: Date;
  
  reportingManagerId?: string;
  reportingManagerApproval?: ApprovalStatus;
  reportingManagerRemarks?: string;
  reportingManagerDate?: Date;
  
  hrApproval?: ApprovalStatus;
  hrRemarks?: string;
  hrApprovalDate?: Date;
  
  // Leave Balance Impact
  leaveBalanceBefore?: number;
  leaveBalanceAfter?: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

enum LeaveType {
  CASUAL_LEAVE = 'CASUAL_LEAVE',
  SICK_LEAVE = 'SICK_LEAVE',
  EARNED_LEAVE = 'EARNED_LEAVE',
  PRIVILEGE_LEAVE = 'PRIVILEGE_LEAVE',
  MATERNITY_LEAVE = 'MATERNITY_LEAVE',
  PATERNITY_LEAVE = 'PATERNITY_LEAVE',
  COMPENSATORY_OFF = 'COMPENSATORY_OFF',
  LOSS_OF_PAY = 'LOSS_OF_PAY',
  EMERGENCY_LEAVE = 'EMERGENCY_LEAVE',
  STUDY_LEAVE = 'STUDY_LEAVE',
  SABBATICAL = 'SABBATICAL',
  BEREAVEMENT_LEAVE = 'BEREAVEMENT_LEAVE'
}

enum LeaveReasonCategory {
  MEDICAL = 'MEDICAL',
  PERSONAL = 'PERSONAL',
  FAMILY = 'FAMILY',
  VACATION = 'VACATION',
  STUDY = 'STUDY',
  OTHER = 'OTHER'
}

enum LeaveStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  WITHDRAWN = 'WITHDRAWN'
}

enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}
```

#### 2.1.9 Performance Appraisal

```typescript
interface PerformanceAppraisal {
  id: string;
  staffId: string;                     // FK to Staff
  
  // Appraisal Period
  appraisalType: AppraisalType;
  periodFrom: Date;
  periodTo: Date;
  
  // Appraiser
  appraiserId: string;                 // FK to Staff (reporting manager)
  reviewerId?: string;                 // FK to Staff (reviewer/HOD)
  
  // Goals & Objectives
  goalsSet: PerformanceGoal[];
  goalsAchieved: number;               // Out of total goals
  
  // Ratings
  competencyRatings: CompetencyRating[];
  overallRating: number;               // 1-5 scale
  overallGrade: PerformanceGrade;
  
  // Feedback
  strengths?: string;
  areasOfImprovement?: string;
  appraiserComments?: string;
  employeeComments?: string;
  reviewerComments?: string;
  
  // Development Plan
  trainingRecommendations?: string[];
  careerDevelopmentPlan?: string;
  
  // Outcomes
  incrementRecommended: boolean;
  incrementPercentage?: number;
  promotionRecommended: boolean;
  promotionTo?: string;
  
  // Status
  status: AppraisalStatus;
  
  // Signatures
  employeeAcknowledgement: boolean;
  employeeAckDate?: Date;
  appraiserSignature: boolean;
  appraiserSignDate?: Date;
  reviewerSignature?: boolean;
  reviewerSignDate?: Date;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

enum AppraisalType {
  PROBATION_REVIEW = 'PROBATION_REVIEW',
  QUARTERLY = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  ANNUAL = 'ANNUAL',
  PROJECT_BASED = 'PROJECT_BASED',
  EXIT_APPRAISAL = 'EXIT_APPRAISAL'
}

interface PerformanceGoal {
  id: string;
  description: string;
  category: GoalCategory;
  weightage: number;                   // % weightage
  targetMetric?: string;
  targetValue?: string;
  achievedValue?: string;
  achievement: number;                 // % achievement
  rating: number;                      // 1-5
}

enum GoalCategory {
  CLINICAL_EXCELLENCE = 'CLINICAL_EXCELLENCE',
  PATIENT_SATISFACTION = 'PATIENT_SATISFACTION',
  TEAM_COLLABORATION = 'TEAM_COLLABORATION',
  QUALITY_IMPROVEMENT = 'QUALITY_IMPROVEMENT',
  REVENUE_GENERATION = 'REVENUE_GENERATION',
  COST_OPTIMIZATION = 'COST_OPTIMIZATION',
  SKILL_DEVELOPMENT = 'SKILL_DEVELOPMENT',
  COMPLIANCE = 'COMPLIANCE',
  OTHER = 'OTHER'
}

interface CompetencyRating {
  competencyName: string;
  competencyCategory: CompetencyCategory;
  rating: number;                      // 1-5
  comments?: string;
}

enum CompetencyCategory {
  CLINICAL_SKILLS = 'CLINICAL_SKILLS',
  COMMUNICATION = 'COMMUNICATION',
  TEAMWORK = 'TEAMWORK',
  LEADERSHIP = 'LEADERSHIP',
  PROBLEM_SOLVING = 'PROBLEM_SOLVING',
  ADAPTABILITY = 'ADAPTABILITY',
  PROFESSIONALISM = 'PROFESSIONALISM',
  TECHNICAL_SKILLS = 'TECHNICAL_SKILLS',
  PATIENT_CARE = 'PATIENT_CARE',
  COMPLIANCE = 'COMPLIANCE'
}

enum PerformanceGrade {
  OUTSTANDING = 'OUTSTANDING',         // 4.5 - 5.0
  EXCEEDS_EXPECTATIONS = 'EXCEEDS_EXPECTATIONS', // 3.5 - 4.49
  MEETS_EXPECTATIONS = 'MEETS_EXPECTATIONS', // 2.5 - 3.49
  NEEDS_IMPROVEMENT = 'NEEDS_IMPROVEMENT', // 1.5 - 2.49
  UNSATISFACTORY = 'UNSATISFACTORY'    // < 1.5
}

enum AppraisalStatus {
  NOT_STARTED = 'NOT_STARTED',
  SELF_APPRAISAL_PENDING = 'SELF_APPRAISAL_PENDING',
  APPRAISER_REVIEW_PENDING = 'APPRAISER_REVIEW_PENDING',
  REVIEWER_APPROVAL_PENDING = 'REVIEWER_APPROVAL_PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}
```

### 2.2 Entity Relationship Diagram

```
┌──────────────────┐
│    BRANCH        │
└────────┬─────────┘
         │
         │ 1:N
         │
┌────────▼─────────────────────────────────────────────────┐
│                     STAFF                                 │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Personal Info, Employment, Identity, etc.        │    │
│  └──────────────────────────────────────────────────┘    │
└─────┬────────┬────────┬────────┬────────┬────────┬───────┘
      │        │        │        │        │        │
      │        │        │        │        │        │
   ┌──▼───┐ ┌─▼────┐ ┌─▼────┐ ┌─▼────┐ ┌─▼────┐ ┌─▼────┐
   │CREDE-│ │PRIVI-│ │DEPT  │ │TRAIN-│ │SCHED-│ │PERF. │
   │NTIALS│ │LEGES │ │ASSGN │ │ING   │ │ULE   │ │APPR. │
   └──────┘ └──────┘ └──┬───┘ └──────┘ └──────┘ └──────┘
                        │
                        │ N:1
                        │
                   ┌────▼────────┐
                   │ DEPARTMENT  │
                   └─────────────┘


┌──────────────────┐
│ SPECIALTY MASTER │
└────────┬─────────┘
         │
         │ N:M
         │
┌────────▼─────────┐
│   STAFF          │
│ (primary/        │
│  secondary)      │
└──────────────────┘


┌──────────────────┐         ┌──────────────────┐
│ EMPLOYEE HEALTH  │────────│ VACCINATION       │
│ RECORD           │  1:N   │ RECORDS           │
└──────────────────┘         └──────────────────┘
         │
         │ 1:N
         │
┌────────▼─────────┐
│ OCCUPATIONAL     │
│ INJURY RECORDS   │
└──────────────────┘


┌──────────────────┐
│ STAFF INSURANCE  │────── Professional Indemnity
│ & INDEMNITY      │────── Medical Malpractice
└──────────────────┘────── Health Insurance


┌──────────────────┐         ┌──────────────────┐
│ STAFF SCHEDULE   │────────│ ATTENDANCE        │
│                  │  1:1   │                   │
└──────────────────┘         └──────────────────┘


┌──────────────────┐
│ LEAVE REQUEST    │───── Impacts Leave Balance
└──────────────────┘
```

### 2.3 Database Schema

```sql
-- Staff Master
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    
    -- Personal Details
    title VARCHAR(10),
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(30) NOT NULL,
    blood_group VARCHAR(10),
    marital_status VARCHAR(20),
    
    -- Contact
    primary_phone VARCHAR(15) NOT NULL,
    secondary_phone VARCHAR(15),
    personal_email VARCHAR(255),
    official_email VARCHAR(255),
    emergency_contact JSONB,
    
    -- Address
    current_address JSONB NOT NULL,
    permanent_address JSONB NOT NULL,
    is_same_as_current BOOLEAN DEFAULT false,
    
    -- Identity Documents
    identity_proof JSONB,
    
    -- Professional
    staff_category VARCHAR(30) NOT NULL,
    staff_type VARCHAR(50) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES departments(id),
    reporting_to UUID REFERENCES staff(id),
    
    -- Specialties
    primary_specialty_id UUID REFERENCES specialty_master(id),
    secondary_specialties JSONB,
    
    -- Employment
    employment_type VARCHAR(30) NOT NULL,
    employment_status VARCHAR(30) NOT NULL,
    joining_date DATE NOT NULL,
    confirmation_date DATE,
    probation_end_date DATE,
    contract_start_date DATE,
    contract_end_date DATE,
    
    -- Shift & Scheduling
    default_shift_type VARCHAR(30),
    is_full_time BOOLEAN DEFAULT true,
    working_hours_per_week DECIMAL(5,2),
    weekly_off_days JSONB,
    
    -- System Access
    user_id UUID REFERENCES users(id),
    has_system_access BOOLEAN DEFAULT false,
    
    -- Financial
    salary_grade VARCHAR(20),
    bank_details JSONB,
    
    -- Status & Flags
    is_active BOOLEAN DEFAULT true,
    is_available_for_appointment BOOLEAN DEFAULT false,
    is_available_for_duty BOOLEAN DEFAULT true,
    can_prescribe BOOLEAN DEFAULT false,
    can_admit_patients BOOLEAN DEFAULT false,
    can_perform_surgery BOOLEAN DEFAULT false,
    
    -- Media
    photograph_url VARCHAR(500),
    signature_url VARCHAR(500),
    
    -- ABDM
    hpr_id VARCHAR(50),
    hpr_verification_status VARCHAR(30),
    hpr_last_verified_date DATE,
    
    -- Background Verification
    background_verification JSONB,
    police_verification JSONB,
    
    -- Exit
    separation_date DATE,
    separation_reason TEXT,
    separation_type VARCHAR(30),
    exit_interview_completed BOOLEAN DEFAULT false,
    full_and_final_settlement BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    last_active_date DATE
);

-- Staff Credentials
CREATE TABLE staff_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Credential Details
    credential_type VARCHAR(100) NOT NULL,
    credential_category VARCHAR(50) NOT NULL,
    
    -- Registration/License
    registration_number VARCHAR(100) NOT NULL,
    registration_authority VARCHAR(255) NOT NULL,
    state_council VARCHAR(255),
    
    -- Educational (for degrees)
    degree_name VARCHAR(255),
    university VARCHAR(255),
    year_of_passing INTEGER,
    
    -- Validity
    issue_date DATE NOT NULL,
    expiry_date DATE,
    is_lifetime BOOLEAN DEFAULT false,
    
    -- Renewal
    renewal_required BOOLEAN DEFAULT false,
    last_renewal_date DATE,
    next_renewal_date DATE,
    renewal_reminder_days JSONB,
    
    -- Verification
    verification_status VARCHAR(30) NOT NULL,
    verified_by UUID REFERENCES staff(id),
    verification_date DATE,
    verification_remarks TEXT,
    
    -- ABDM HPR
    is_hpr_verified BOOLEAN DEFAULT false,
    hpr_verification_date DATE,
    hpr_verification_response JSONB,
    
    -- Documents
    certificate_url VARCHAR(500),
    supporting_documents JSONB,
    
    -- Status
    status VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    
    UNIQUE(staff_id, credential_type, registration_number)
);

-- Clinical Privileges
CREATE TABLE clinical_privileges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Privilege Details
    privilege_type VARCHAR(50) NOT NULL,
    privilege_name VARCHAR(255) NOT NULL,
    privilege_description TEXT,
    
    -- Scope
    departments JSONB,
    specialties JSONB,
    procedures JSONB,
    
    -- Authorization
    granted_by UUID NOT NULL REFERENCES staff(id),
    granted_by_role VARCHAR(100) NOT NULL,
    granted_date DATE NOT NULL,
    
    -- Validity
    effective_date DATE NOT NULL,
    expiry_date DATE,
    is_lifetime BOOLEAN DEFAULT false,
    
    -- Review
    review_required BOOLEAN DEFAULT true,
    review_cycle VARCHAR(30),
    last_review_date DATE,
    next_review_date DATE,
    reviewed_by UUID REFERENCES staff(id),
    review_remarks TEXT,
    
    -- Conditions
    conditions JSONB,
    restrictions JSONB,
    supervision_required BOOLEAN DEFAULT false,
    supervisor_id UUID REFERENCES staff(id),
    
    -- Competency
    competency_assessment_required BOOLEAN DEFAULT false,
    last_assessment_date DATE,
    assessment_score DECIMAL(5,2),
    assessor_id UUID REFERENCES staff(id),
    
    -- Case Volume
    minimum_case_volume INTEGER,
    current_case_volume INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Documents
    credential_documents JSONB,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Privilege Procedures (for granular tracking)
CREATE TABLE privilege_procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    privilege_id UUID NOT NULL REFERENCES clinical_privileges(id) ON DELETE CASCADE,
    procedure_code VARCHAR(50) NOT NULL,
    procedure_name VARCHAR(255) NOT NULL,
    complexity VARCHAR(30) NOT NULL,
    supervision_required BOOLEAN DEFAULT false,
    cases_performed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff Department Assignment
CREATE TABLE staff_department_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id),
    
    -- Assignment
    is_primary BOOLEAN DEFAULT false,
    role VARCHAR(50) NOT NULL,
    
    -- Allocation
    workload_percentage DECIMAL(5,2),
    expected_hours_per_week DECIMAL(5,2),
    
    -- Authorization
    is_head_of_department BOOLEAN DEFAULT false,
    can_approve_orders BOOLEAN DEFAULT false,
    can_approve_leaves BOOLEAN DEFAULT false,
    can_access_records BOOLEAN DEFAULT false,
    
    -- Validity
    effective_date DATE NOT NULL,
    end_date DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    
    UNIQUE(staff_id, department_id, is_primary)
);

-- Training Master
CREATE TABLE trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Training Details
    training_code VARCHAR(50) UNIQUE NOT NULL,
    training_name VARCHAR(255) NOT NULL,
    training_type VARCHAR(50) NOT NULL,
    training_category VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Provider
    conducted_by VARCHAR(255) NOT NULL,
    trainer_name VARCHAR(255),
    
    -- Content
    syllabus TEXT,
    learning_objectives JSONB,
    
    -- Duration
    duration_hours DECIMAL(5,2) NOT NULL,
    validity_period INTEGER,
    
    -- Mandatory
    is_mandatory BOOLEAN DEFAULT false,
    mandatory_for JSONB,
    
    -- NABH
    is_nabh_required BOOLEAN DEFAULT false,
    nabh_chapter VARCHAR(255),
    
    -- Assessment
    has_assessment BOOLEAN DEFAULT false,
    passing_score DECIMAL(5,2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Staff Training Records
CREATE TABLE staff_training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    training_id UUID NOT NULL REFERENCES trainings(id),
    
    -- Attendance
    training_date DATE NOT NULL,
    attendance_status VARCHAR(30) NOT NULL,
    hours_attended DECIMAL(5,2),
    
    -- Assessment
    assessment_taken BOOLEAN DEFAULT false,
    assessment_score DECIMAL(5,2),
    assessment_date DATE,
    passed BOOLEAN DEFAULT false,
    
    -- Certification
    certificate_issued BOOLEAN DEFAULT false,
    certificate_number VARCHAR(100),
    certificate_url VARCHAR(500),
    certificate_issue_date DATE,
    certificate_expiry_date DATE,
    
    -- Validity
    valid_from DATE NOT NULL,
    valid_upto DATE,
    
    -- Feedback
    trainer_remarks TEXT,
    
    -- Status
    status VARCHAR(30) NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Employee Health Records
CREATE TABLE employee_health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Pre-Employment
    pre_employment_medical_done BOOLEAN DEFAULT false,
    pre_employment_medical_date DATE,
    pre_employment_medical_report VARCHAR(500),
    fit_for_duty BOOLEAN DEFAULT true,
    medical_restrictions JSONB,
    
    -- Periodic
    last_medical_checkup_date DATE,
    next_medical_checkup_due DATE,
    annual_checkup_frequency INTEGER DEFAULT 12,
    
    -- Medical History
    chronic_conditions JSONB,
    allergies JSONB,
    blood_group VARCHAR(10),
    
    -- Exposure
    has_blood_exposure_risk BOOLEAN DEFAULT false,
    has_radiation_exposure BOOLEAN DEFAULT false,
    has_chemical_exposure BOOLEAN DEFAULT false,
    has_biological_exposure BOOLEAN DEFAULT false,
    
    -- Leave
    total_medical_leave_days INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vaccination Records
CREATE TABLE vaccination_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    vaccine_type VARCHAR(50) NOT NULL,
    vaccine_name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255),
    batch_number VARCHAR(100),
    
    dose_number INTEGER NOT NULL,
    total_doses INTEGER NOT NULL,
    
    administered_date DATE NOT NULL,
    administered_by VARCHAR(255),
    administration_site VARCHAR(100),
    
    next_dose_date DATE,
    
    certificate_url VARCHAR(500),
    
    -- Adverse Events
    adverse_reaction BOOLEAN DEFAULT false,
    reaction_details TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Occupational Injuries
CREATE TABLE occupational_injuries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    incident_date DATE NOT NULL,
    incident_time TIME,
    incident_location VARCHAR(255) NOT NULL,
    
    injury_type VARCHAR(50) NOT NULL,
    injury_description TEXT NOT NULL,
    body_part_affected VARCHAR(255),
    
    treatment_given TEXT,
    treating_physician VARCHAR(255),
    
    days_lost_due_to_injury INTEGER DEFAULT 0,
    
    incident_report_filed BOOLEAN DEFAULT false,
    incident_report_number VARCHAR(100),
    incident_report_url VARCHAR(500),
    
    compensation_claimed BOOLEAN DEFAULT false,
    compensation_amount DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fitness Certificates
CREATE TABLE fitness_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    certificate_type VARCHAR(30) NOT NULL,
    
    examination_date DATE NOT NULL,
    examining_physician VARCHAR(255) NOT NULL,
    
    fit_for_duty BOOLEAN NOT NULL,
    restrictions JSONB,
    remarks TEXT,
    
    valid_from DATE NOT NULL,
    valid_upto DATE,
    
    certificate_url VARCHAR(500),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff Insurance
CREATE TABLE staff_insurance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Insurance
    insurance_type VARCHAR(50) NOT NULL,
    insurance_provider VARCHAR(255) NOT NULL,
    policy_number VARCHAR(100) NOT NULL,
    
    -- Coverage
    coverage_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    coverage_details TEXT,
    
    -- Validity
    policy_start_date DATE NOT NULL,
    policy_end_date DATE NOT NULL,
    
    -- Premium
    premium_amount DECIMAL(10,2),
    premium_frequency VARCHAR(30),
    premium_paid_by VARCHAR(30),
    
    -- Documents
    policy_document_url VARCHAR(500),
    
    -- Claims
    claims_made INTEGER DEFAULT 0,
    last_claim_date DATE,
    
    -- Status
    status VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Renewal
    renewal_reminder_days JSONB,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Staff Schedules
CREATE TABLE staff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Schedule
    schedule_date DATE NOT NULL,
    shift_type VARCHAR(30) NOT NULL,
    
    -- Timing
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Location
    department_id UUID REFERENCES departments(id),
    unit_id UUID REFERENCES units(id),
    location VARCHAR(255),
    
    -- Type
    schedule_type VARCHAR(30) NOT NULL,
    
    -- OPD
    opd_slots INTEGER,
    slot_duration INTEGER,
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    
    -- Actual
    actual_check_in TIMESTAMP,
    actual_check_out TIMESTAMP,
    hours_worked DECIMAL(5,2),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    
    UNIQUE(staff_id, schedule_date, start_time)
);

-- Attendance
CREATE TABLE staff_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES staff_schedules(id),
    
    -- Date & Time
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    
    -- Location
    check_in_location VARCHAR(255),
    check_out_location VARCHAR(255),
    
    -- Calculation
    expected_hours DECIMAL(5,2) NOT NULL,
    actual_hours DECIMAL(5,2),
    overtime DECIMAL(5,2),
    late_by INTEGER,
    early_leave_by INTEGER,
    
    -- Status
    attendance_status VARCHAR(30) NOT NULL,
    
    -- Approval
    approved_by UUID REFERENCES staff(id),
    approval_date DATE,
    approval_remarks TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(staff_id, attendance_date)
);

-- Leave Requests
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Leave
    leave_type VARCHAR(50) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    number_of_days DECIMAL(5,2) NOT NULL,
    is_half_day BOOLEAN DEFAULT false,
    half_day_period VARCHAR(20),
    
    -- Reason
    reason TEXT NOT NULL,
    reason_category VARCHAR(30),
    
    -- Documents
    medical_certificate VARCHAR(500),
    supporting_documents JSONB,
    
    -- Approval
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
    applied_date DATE NOT NULL,
    
    reporting_manager_id UUID REFERENCES staff(id),
    reporting_manager_approval VARCHAR(30),
    reporting_manager_remarks TEXT,
    reporting_manager_date DATE,
    
    hr_approval VARCHAR(30),
    hr_remarks TEXT,
    hr_approval_date DATE,
    
    -- Balance
    leave_balance_before DECIMAL(5,2),
    leave_balance_after DECIMAL(5,2),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Appraisals
CREATE TABLE performance_appraisals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Period
    appraisal_type VARCHAR(30) NOT NULL,
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    
    -- Appraisers
    appraiser_id UUID NOT NULL REFERENCES staff(id),
    reviewer_id UUID REFERENCES staff(id),
    
    -- Goals
    goals_set JSONB,
    goals_achieved INTEGER,
    
    -- Ratings
    competency_ratings JSONB,
    overall_rating DECIMAL(3,2),
    overall_grade VARCHAR(30),
    
    -- Feedback
    strengths TEXT,
    areas_of_improvement TEXT,
    appraiser_comments TEXT,
    employee_comments TEXT,
    reviewer_comments TEXT,
    
    -- Development
    training_recommendations JSONB,
    career_development_plan TEXT,
    
    -- Outcomes
    increment_recommended BOOLEAN DEFAULT false,
    increment_percentage DECIMAL(5,2),
    promotion_recommended BOOLEAN DEFAULT false,
    promotion_to VARCHAR(255),
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    
    -- Signatures
    employee_acknowledgement BOOLEAN DEFAULT false,
    employee_ack_date DATE,
    appraiser_signature BOOLEAN DEFAULT false,
    appraiser_sign_date DATE,
    reviewer_signature BOOLEAN DEFAULT false,
    reviewer_sign_date DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_staff_branch ON staff(branch_id);
CREATE INDEX idx_staff_category ON staff(staff_category);
CREATE INDEX idx_staff_type ON staff(staff_type);
CREATE INDEX idx_staff_department ON staff(department_id);
CREATE INDEX idx_staff_active ON staff(is_active, employment_status);
CREATE INDEX idx_staff_hpr ON staff(hpr_id);

CREATE INDEX idx_credentials_staff ON staff_credentials(staff_id);
CREATE INDEX idx_credentials_type ON staff_credentials(credential_type);
CREATE INDEX idx_credentials_expiry ON staff_credentials(expiry_date);
CREATE INDEX idx_credentials_status ON staff_credentials(status);

CREATE INDEX idx_privileges_staff ON clinical_privileges(staff_id);
CREATE INDEX idx_privileges_type ON clinical_privileges(privilege_type);
CREATE INDEX idx_privileges_status ON clinical_privileges(status);

CREATE INDEX idx_dept_assign_staff ON staff_department_assignments(staff_id);
CREATE INDEX idx_dept_assign_dept ON staff_department_assignments(department_id);

CREATE INDEX idx_training_records_staff ON staff_training_records(staff_id);
CREATE INDEX idx_training_records_training ON staff_training_records(training_id);

CREATE INDEX idx_schedules_staff_date ON staff_schedules(staff_id, schedule_date);
CREATE INDEX idx_schedules_department ON staff_schedules(department_id);

CREATE INDEX idx_attendance_staff_date ON staff_attendance(staff_id, attendance_date);

CREATE INDEX idx_leaves_staff ON leave_requests(staff_id);
CREATE INDEX idx_leaves_status ON leave_requests(status);

CREATE INDEX idx_appraisals_staff ON performance_appraisals(staff_id);
CREATE INDEX idx_appraisals_period ON performance_appraisals(period_from, period_to);
```

---

## 3. Staff Onboarding Workflow

### 3.1 Complete Onboarding Process

```
┌─────────────────────────────────────────────────────────────────┐
│               STAFF ONBOARDING WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1: PRE-JOINING                                            │
│  ┌───────────────────────────────────────────────────┐          │
│  │ 1.1 OFFER ACCEPTED                                │          │
│  │     • Collect acceptance letter                   │          │
│  │     • Request required documents                  │          │
│  │                                                   │          │
│  │ 1.2 DOCUMENTATION VERIFICATION                    │          │
│  │     Required Documents:                           │          │
│  │     Clinical Staff:                               │          │
│  │       - Educational Certificates                  │          │
│  │       - Professional Registration                 │          │
│  │       - MCI/Nursing Council/Pharmacy Council      │          │
│  │       - Experience Certificates                   │          │
│  │       - Last 3 months salary slips               │          │
│  │       - Relieving letter from previous employer   │          │
│  │     All Staff:                                    │          │
│  │       - Identity Proof (Aadhar, PAN, Passport)    │          │
│  │       - Address Proof                             │          │
│  │       - 2 Passport size photographs               │          │
│  │       - Bank account details                      │          │
│  │                                                   │          │
│  │ 1.3 BACKGROUND VERIFICATION                       │          │
│  │     • Initiate background check (mandatory)       │          │
│  │     • Police verification (for certain roles)     │          │
│  │     • Reference checks (2-3 references)           │          │
│  │     • Previous employment verification            │          │
│  │     • Education verification                      │          │
│  │     • Wait for clearance report                   │          │
│  │                                                   │          │
│  │ 1.4 PRE-EMPLOYMENT MEDICAL                        │          │
│  │     • Schedule medical examination                │          │
│  │     • Blood tests, X-ray as needed                │          │
│  │     • Vaccination status check                    │          │
│  │       - Hepatitis B (mandatory for clinical)      │          │
│  │       - COVID-19 vaccination                      │          │
│  │       - Others as per hospital policy             │          │
│  │     • Medical fitness certificate                 │          │
│  │     • Identify any restrictions                   │          │
│  │                                                   │          │
│  │ 1.5 CONTRACT PREPARATION                          │          │
│  │     • Prepare employment contract                 │          │
│  │     • Set salary, benefits, T&C                   │          │
│  │     • NDA, non-compete if applicable              │          │
│  │     • Professional indemnity insurance            │          │
│  │       (mandatory for doctors)                     │          │
│  │                                                   │          │
│  │ Status: OFFER_ACCEPTED → PRE_JOINING              │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  PHASE 2: JOINING DAY (Day 1)                                    │
│  ┌───────────────────────────────────────────────────┐          │
│  │ 2.1 EMPLOYEE CODE GENERATION                      │          │
│  │     • Auto-generate: EMP-{BRANCH}-{DEPT}-{SEQ}    │          │
│  │     • Example: EMP-BLR-CARD-0042                  │          │
│  │                                                   │          │
│  │ 2.2 CREATE STAFF PROFILE IN SYSTEM               │          │
│  │     See detailed flow in Section 3.2 below        │          │
│  │                                                   │          │
│  │ 2.3 SYSTEM ACCESS PROVISIONING                    │          │
│  │     • Create user account                         │          │
│  │     • Assign role based on designation            │          │
│  │     • Set permissions                             │          │
│  │     • Provide login credentials                   │          │
│  │     • 2FA setup                                   │          │
│  │                                                   │          │
│  │ 2.4 ISSUE STAFF ID CARD                           │          │
│  │     • Take photograph                             │          │
│  │     • Capture biometric (fingerprint)             │          │
│  │     • Print ID card                               │          │
│  │     • Assign access card/RFID                     │          │
│  │     • Setup biometric attendance                  │          │
│  │                                                   │          │
│  │ 2.5 ASSET ALLOCATION                              │          │
│  │     • Workstation/locker assignment               │          │
│  │     • Uniform (if applicable)                     │          │
│  │     • Stethoscope, equipment (for clinical)       │          │
│  │     • Name badge                                  │          │
│  │     • Keys/access cards                           │          │
│  │                                                   │          │
│  │ Status: PRE_JOINING → JOINED                      │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  PHASE 3: ORIENTATION & TRAINING (Week 1)                        │
│  ┌───────────────────────────────────────────────────┐          │
│  │ 3.1 GENERAL ORIENTATION                           │          │
│  │     • Hospital overview, mission, vision          │          │
│  │     • Organizational structure                    │          │
│  │     • Policies and procedures                     │          │
│  │     • Code of conduct                             │          │
│  │     • Patient rights and responsibilities         │          │
│  │     • Duration: 2 hours                           │          │
│  │                                                   │          │
│  │ 3.2 MANDATORY TRAINING (NABH Required)            │          │
│  │     ✓ Infection Control (4 hours)                 │          │
│  │       - Hand hygiene                              │          │
│  │       - Standard precautions                      │          │
│  │       - Biomedical waste management               │          │
│  │       - Isolation precautions                     │          │
│  │     ✓ Fire Safety (2 hours)                       │          │
│  │       - Fire extinguisher use                     │          │
│  │       - Evacuation procedures                     │          │
│  │       - Fire zones                                │          │
│  │     ✓ Patient Safety (2 hours)                    │          │
│  │       - Patient identification                    │          │
│  │       - Fall prevention                           │          │
│  │       - Medication safety                         │          │
│  │       - Incident reporting                        │          │
│  │     ✓ NABH Standards Overview (3 hours)           │          │
│  │     ✓ POSH (Prevention of Sexual Harassment) (1hr)│          │
│  │     ✓ Information Security (1 hour)               │          │
│  │     ✓ Emergency Response (2 hours)                │          │
│  │       - Code Blue, Code Red protocols             │          │
│  │       - Disaster management                       │          │
│  │                                                   │          │
│  │ 3.3 DEPARTMENT-SPECIFIC TRAINING                  │          │
│  │     • Department orientation                      │          │
│  │     • Equipment familiarization                   │          │
│  │     • Department SOPs                             │          │
│  │     • IT systems training (EMR, OPD, etc.)        │          │
│  │     • Duration: Varies by department              │          │
│  │                                                   │          │
│  │ 3.4 ROLE-SPECIFIC TRAINING                        │          │
│  │     Doctors:                                      │          │
│  │       - EMR documentation                         │          │
│  │       - E-prescribing system                      │          │
│  │       - Order management                          │          │
│  │       - Clinical protocols                        │          │
│  │     Nurses:                                       │          │
│  │       - Medication administration                 │          │
│  │       - Nursing documentation                     │          │
│  │       - Vital signs monitoring                    │          │
│  │       - Care plans                                │          │
│  │     Technicians:                                  │          │
│  │       - Equipment operation                       │          │
│  │       - Sample collection/processing              │          │
│  │       - Quality control                           │          │
│  │       - Report generation                         │          │
│  │                                                   │          │
│  │ Status: JOINED → ON_PROBATION                     │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  PHASE 4: PROBATION PERIOD (3-6 months)                          │
│  ┌───────────────────────────────────────────────────┐          │
│  │ 4.1 PROBATION TRACKING                            │          │
│  │     • Monitor performance                         │          │
│  │     • Regular feedback sessions                   │          │
│  │     • Document observations                       │          │
│  │     • Skill assessments                           │          │
│  │                                                   │          │
│  │ 4.2 MID-PROBATION REVIEW (at 3 months)            │          │
│  │     • Formal appraisal                            │          │
│  │     • Identify training needs                     │          │
│  │     • Address performance gaps                    │          │
│  │     • Extension/early confirmation decision       │          │
│  │                                                   │          │
│  │ 4.3 PROBATION COMPLETION                          │          │
│  │     • Final appraisal                             │          │
│  │     • Confirmation letter if successful           │          │
│  │     • Update employment status in system          │          │
│  │     • OR termination if unsuccessful              │          │
│  │                                                   │          │
│  │ Status: ON_PROBATION → ACTIVE (if confirmed)      │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  PHASE 5: ONGOING COMPLIANCE                                     │
│  ┌───────────────────────────────────────────────────┐          │
│  │ 5.1 ANNUAL REQUIREMENTS                           │          │
│  │     • Annual medical checkup                      │          │
│  │     • Infection control refresher                 │          │
│  │     • Fire safety drill participation             │          │
│  │     • NABH training updates                       │          │
│  │     • Performance appraisal                       │          │
│  │                                                   │          │
│  │ 5.2 LICENSE/CREDENTIAL RENEWALS                   │          │
│  │     • System auto-alerts before expiry            │          │
│  │     • Track renewal applications                  │          │
│  │     • Update system post-renewal                  │          │
│  │                                                   │          │
│  │ 5.3 CONTINUING EDUCATION (For Clinical)           │          │
│  │     • CME credits tracking                        │          │
│  │     • Conference/workshop attendance              │          │
│  │     • Journal club participation                  │          │
│  │     • Maintain competency                         │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Staff Profile Creation Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────┐
│           STAFF PROFILE CREATION - STEP BY STEP                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: INITIATE CREATION                                       │
│  ┌───────────────────────────────────────────────────┐          │
│  │ User: HR Admin / Department Admin                 │          │
│  │ Action: Navigate to "Staff" → "Add New Staff"     │          │
│  │                                                   │          │
│  │ Select Branch (if multi-branch):                  │          │
│  │   [Bangalore Main Hospital ▼]                     │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 2: PERSONAL INFORMATION                                    │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Basic Details:                                    │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Title: [Dr. ▼]                          │       │          │
│  │ │ First Name: [Rajesh]                    │       │          │
│  │ │ Middle Name: [Kumar] (optional)         │       │          │
│  │ │ Last Name: [Sharma]                     │       │          │
│  │ │                                         │       │          │
│  │ │ Display Name: Dr. Rajesh Kumar Sharma   │       │          │
│  │ │   (auto-computed, editable)             │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Personal Details:                                 │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Date of Birth: [15-May-1985]            │       │          │
│  │ │   Age: 40 years (computed)              │       │          │
│  │ │                                         │       │          │
│  │ │ Gender: ○ Male ○ Female ○ Other         │       │          │
│  │ │                                         │       │          │
│  │ │ Blood Group: [O+ ▼]                     │       │          │
│  │ │                                         │       │          │
│  │ │ Marital Status: [Married ▼]             │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 3: CONTACT INFORMATION                                     │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Phone Numbers: (CRITICAL)                         │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Primary Phone: [+91-9876543210]         │       │          │
│  │ │   (Used for system SMS/OTP)             │       │          │
│  │ │                                         │       │          │
│  │ │ Secondary Phone: [+91-9876543211]       │       │          │
│  │ │   (optional)                            │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Email Addresses:                                  │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Personal Email: [rajesh@gmail.com]      │       │          │
│  │ │                                         │       │          │
│  │ │ Official Email: (auto-generated)        │       │          │
│  │ │   [rajesh.sharma@hospital.com]          │       │          │
│  │ │   [✓] Send credentials to this email    │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Emergency Contact:                                │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Name: [Priya Sharma]                    │       │          │
│  │ │ Relationship: [Spouse ▼]                │       │          │
│  │ │ Phone: [+91-9876543212]                 │       │          │
│  │ │ Alternate: [+91-9876543213]             │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 4: ADDRESS DETAILS                                         │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Current Address:                                  │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Address Line 1: [Flat 402, Tower A]     │       │          │
│  │ │ Address Line 2: [Green Meadows Apts]    │       │          │
│  │ │ City: [Bangalore]                       │       │          │
│  │ │ State: [Karnataka ▼]                    │       │          │
│  │ │ Country: [India]                        │       │          │
│  │ │ Pincode: [560068]                       │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Permanent Address:                                │          │
│  │   [✓] Same as current address                     │          │
│  │                                                   │          │
│  │   OR manually enter if different                  │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 5: IDENTITY DOCUMENTS                                      │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Identity Proof (Upload scans):                    │          │
│  │                                                   │          │
│  │ Aadhar Card: (MANDATORY)                          │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Aadhar Number: [XXXX-XXXX-1234]         │       │          │
│  │ │   (last 4 digits shown)                 │       │          │
│  │ │ Upload Scan: [Browse...] [aadhar.pdf]   │       │          │
│  │ │ [✓] Verified by HR                      │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ PAN Card: (MANDATORY for salary)                  │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ PAN Number: [ABCDE1234F]                │       │          │
│  │ │ Upload Scan: [Browse...] [pan.pdf]      │       │          │
│  │ │ [✓] Verified by HR                      │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Other Documents (Optional):                       │          │
│  │ [ ] Passport                                      │          │
│  │ [ ] Driving License                               │          │
│  │ [ ] Voter ID                                      │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 6: PROFESSIONAL DETAILS                                    │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Employment Classification:                        │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Staff Category:                         │       │          │
│  │ │   ● CLINICAL ○ NON-CLINICAL             │       │          │
│  │ │                                         │       │          │
│  │ │ Staff Type: [Doctor - Consultant ▼]    │       │          │
│  │ │   (Filtered based on category)          │       │          │
│  │ │                                         │       │          │
│  │ │ Designation: [Consultant Cardiologist]  │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Department & Specialty (for Clinical):            │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Primary Department:                     │       │          │
│  │ │   [Cardiology OPD ▼]                    │       │          │
│  │ │                                         │       │          │
│  │ │ Primary Specialty:                      │       │          │
│  │ │   [Cardiology ▼]                        │       │          │
│  │ │                                         │       │          │
│  │ │ Secondary Specialties: (optional)       │       │          │
│  │ │   [+ Add Specialty]                     │       │          │
│  │ │   • Interventional Cardiology           │       │          │
│  │ │   • Electrophysiology                   │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Reporting Structure:                              │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Reports To:                             │       │          │
│  │ │   [Dr. Anil Kumar - HOD Cardiology ▼]   │       │          │
│  │ │                                         │       │          │
│  │ │ Role in Department:                     │       │          │
│  │ │   [Senior Consultant ▼]                 │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 7: EMPLOYMENT DETAILS                                      │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Employment Type & Dates:                          │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Employment Type:                        │       │          │
│  │ │   ○ Permanent                           │       │          │
│  │ │   ● Consultant                          │       │          │
│  │ │   ○ Contract                            │       │          │
│  │ │   ○ Visiting                            │       │          │
│  │ │                                         │       │          │
│  │ │ Joining Date: [01-Jan-2025]             │       │          │
│  │ │                                         │       │          │
│  │ │ Probation Period: [3 months ▼]          │       │          │
│  │ │ Probation Ends: 31-Mar-2025 (computed)  │       │          │
│  │ │                                         │       │          │
│  │ │ If Contract/Consultant:                 │       │          │
│  │ │   Contract Start: [01-Jan-2025]         │       │          │
│  │ │   Contract End: [31-Dec-2025]           │       │          │
│  │ │   Auto-renewal: [Yes/No]                │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Work Schedule:                                    │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ [✓] Full Time                           │       │          │
│  │ │ Working Hours/Week: [40]                │       │          │
│  │ │                                         │       │          │
│  │ │ Default Shift: [General (9 AM - 6 PM) ▼]│       │          │
│  │ │                                         │       │          │
│  │ │ Weekly Offs:                            │       │          │
│  │ │   [✓] Sunday                            │       │          │
│  │ │   [ ] Monday ... [ ] Saturday           │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 8: CREDENTIALS & LICENSES (For Clinical Staff)             │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Educational Qualifications:                       │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Degree: [MBBS ▼]                        │       │          │
│  │ │ University: [AIIMS New Delhi]           │       │          │
│  │ │ Year: [2008]                            │       │          │
│  │ │ Certificate: [Browse...] [mbbs.pdf]     │       │          │
│  │ │ [✓] Verified                            │       │          │
│  │ │                                         │       │          │
│  │ │ [+ Add Another Degree]                  │       │          │
│  │ │                                         │       │          │
│  │ │ Post-Graduation:                        │       │          │
│  │ │ Degree: [MD - Cardiology ▼]             │       │          │
│  │ │ University: [PGI Chandigarh]            │       │          │
│  │ │ Year: [2012]                            │       │          │
│  │ │ Certificate: [Browse...] [md.pdf]       │       │          │
│  │ │ [✓] Verified                            │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Professional Registration:                        │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ MCI Registration:                       │       │          │
│  │ │   Number: [MCI-12345/2012]              │       │          │
│  │ │   Issue Date: [15-Jun-2012]             │       │          │
│  │ │   Expiry: [Lifetime ▼]                  │       │          │
│  │ │   Certificate: [mci_cert.pdf]           │       │          │
│  │ │   Status: [✓] Verified                  │       │          │
│  │ │                                         │       │          │
│  │ │ State Registration (Karnataka):         │       │          │
│  │ │   Number: [KMC/2012/67890]              │       │          │
│  │ │   Issue Date: [20-Jun-2012]             │       │          │
│  │ │   Renewal Date: [20-Jun-2027]           │       │          │
│  │ │   Certificate: [kmc_cert.pdf]           │       │          │
│  │ │   Status: [✓] Verified                  │       │          │
│  │ │                                         │       │          │
│  │ │ [✓] Verify via ABDM HPR                 │       │          │
│  │ │   HPR ID: (will be auto-populated)      │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Additional Certifications:                        │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ [+ Add Certification]                   │       │          │
│  │ │                                         │       │          │
│  │ │ • ACLS (Advanced Cardiac Life Support)  │       │          │
│  │ │   Valid Until: 15-Dec-2026              │       │          │
│  │ │                                         │       │          │
│  │ │ • BLS (Basic Life Support)              │       │          │
│  │ │   Valid Until: 10-Jan-2026              │       │          │
│  │ │   ⚠️ Expiring Soon!                     │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 9: CLINICAL PRIVILEGES (Doctors Only)                      │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Grant Clinical Privileges:                        │          │
│  │                                                   │          │
│  │ [+ Add Privilege]                                 │          │
│  │                                                   │          │
│  │ Privilege 1:                                      │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Type: [ADMITTING ▼]                     │       │          │
│  │ │ Departments: [Cardiology ▼] [+ Add]     │       │          │
│  │ │ Effective From: [01-Jan-2025]           │       │          │
│  │ │ Validity: [Indefinite ▼]                │       │          │
│  │ │ Granted By: [Dr. Anil Kumar - HOD]      │       │          │
│  │ │ [✓] Approved                            │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Privilege 2:                                      │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Type: [PROCEDURE ▼]                     │       │          │
│  │ │ Procedures:                             │       │          │
│  │ │   • Angioplasty                         │       │          │
│  │ │   • Pacemaker Implantation              │       │          │
│  │ │   • Coronary Angiography                │       │          │
│  │ │ Supervision Required: [No]              │       │          │
│  │ │ Review Cycle: [Annual ▼]                │       │          │
│  │ │ [✓] Approved                            │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ See Section 5 for detailed privilege flow        │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 10: SYSTEM ACCESS & PERMISSIONS                            │
│  ┌───────────────────────────────────────────────────┐          │
│  │ User Account Creation:                            │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ [✓] Create System User Account          │       │          │
│  │ │                                         │       │          │
│  │ │ Username: [rajesh.sharma]               │       │          │
│  │ │   (auto-generated from name)            │       │          │
│  │ │                                         │       │          │
│  │ │ Role: [Doctor - Consultant ▼]           │       │          │
│  │ │   (auto-selected based on staff type)   │       │          │
│  │ │                                         │       │          │
│  │ │ Access Modules:                         │       │          │
│  │ │   [✓] OPD (Consultation)                │       │          │
│  │ │   [✓] IPD (Admission & Progress Notes)  │       │          │
│  │ │   [✓] EMR (Complete Access)             │       │          │
│  │ │   [✓] Investigations (Order & View)     │       │          │
│  │ │   [✓] Pharmacy (Prescriptions)          │       │          │
│  │ │   [✓] OT (Surgery Authorization)        │       │          │
│  │ │   [ ] Billing (Read Only)               │       │          │
│  │ │   [ ] Admin Modules                     │       │          │
│  │ │                                         │       │          │
│  │ │ E-Signature Setup:                      │       │          │
│  │ │   [✓] Enable Electronic Signature       │       │          │
│  │ │   Signature Image: [Browse...] [sig.png]│       │          │
│  │ │                                         │       │          │
│  │ │ Credentials:                            │       │          │
│  │ │   Initial Password: (auto-generated)    │       │          │
│  │ │   [✓] Send to rajesh.sharma@hospital.com│       │          │
│  │ │   [✓] Force password change on login    │       │          │
│  │ │   [✓] Enable 2FA                        │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 11: BACKGROUND VERIFICATION STATUS                         │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Background Verification:                          │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Status: [✓] Verified                    │       │          │
│  │ │ Verified By: ABC Verification Services  │       │          │
│  │ │ Date: 20-Dec-2024                       │       │          │
│  │ │ Report: [bg_report.pdf]                 │       │          │
│  │ │ Cleared for Employment: [Yes]           │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Police Verification:                              │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Status: [✓] Verified                    │       │          │
│  │ │ Police Station: Koramangala PS          │       │          │
│  │ │ Application No: PV-2024-12345           │       │          │
│  │ │ Verification Date: 22-Dec-2024          │       │          │
│  │ │ Certificate: [police_cert.pdf]          │       │          │
│  │ │ Valid Until: 22-Dec-2029                │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 12: EMPLOYEE HEALTH RECORD                                 │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Pre-Employment Medical:                           │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ [✓] Medical Examination Done            │       │          │
│  │ │ Date: 18-Dec-2024                       │       │          │
│  │ │ Examined By: Dr. Health Checkup         │       │          │
│  │ │ Report: [medical_report.pdf]            │       │          │
│  │ │ Fit for Duty: [✓] Yes [ ] No            │       │          │
│  │ │ Restrictions: None                      │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Vaccination Status:                               │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Hepatitis B: [✓] Complete (3 doses)     │       │          │
│  │ │   Last Dose: 15-Jun-2010                │       │          │
│  │ │   Certificate: [hep_b_cert.pdf]         │       │          │
│  │ │                                         │       │          │
│  │ │ COVID-19: [✓] Vaccinated                │       │          │
│  │ │   Doses: 3 (2 primary + 1 booster)      │       │          │
│  │ │   Last Dose: 10-Aug-2023                │       │          │
│  │ │   Certificate: [covid_cert.pdf]         │       │          │
│  │ │                                         │       │          │
│  │ │ Influenza: [ ] Pending                  │       │          │
│  │ │   ⚠️ Recommended for healthcare workers │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Annual Checkup Schedule:                          │          │
│  │   Next Due: 18-Dec-2025 (auto-calculated)         │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 13: INSURANCE & INDEMNITY (Doctors)                        │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Professional Indemnity Insurance:                 │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Insurance Provider: [XYZ Insurance Co.]  │       │          │
│  │ │ Policy Number: [IND-2025-123456]        │       │          │
│  │ │ Coverage: [₹ 1,00,00,000]               │       │          │
│  │ │ Valid From: 01-Jan-2025                 │       │          │
│  │ │ Valid Until: 31-Dec-2025                │       │          │
│  │ │ Policy Document: [indemnity_policy.pdf] │       │          │
│  │ │ Premium Paid By: [Hospital ▼]           │       │          │
│  │ │ Status: [✓] Active                      │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Group Health Insurance (if applicable):           │          │
│  │   [Add Insurance Details...]                      │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 14: FINANCIAL DETAILS                                      │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Salary Information:                               │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Salary Grade: [C2 - Senior Consultant]  │       │          │
│  │ │ CTC: [Managed in Payroll System]        │       │          │
│  │ │   (Link to payroll integration)         │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Bank Account Details:                             │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Account Holder: [Rajesh Kumar Sharma]   │       │          │
│  │ │ Bank: [HDFC Bank]                       │       │          │
│  │ │ Account Number: [12345678901234]        │       │          │
│  │ │ IFSC Code: [HDFC0001234]                │       │          │
│  │ │ Branch: [Koramangala, Bangalore]        │       │          │
│  │ │ Account Type: [Savings ▼]               │       │          │
│  │ │                                         │       │          │
│  │ │ Cancelled Cheque: [Browse...] [cheque.pdf]│     │          │
│  │ │ [✓] Verified by Finance Team            │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 15: PHOTOGRAPH & BIOMETRIC                                 │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Photograph:                                       │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ [Upload Photo] or [Capture via Webcam]  │       │          │
│  │ │                                         │       │          │
│  │ │ [  Photo Preview  ]                     │       │          │
│  │ │   (passport size)                       │       │          │
│  │ │                                         │       │          │
│  │ │ Requirements:                           │       │          │
│  │ │ • White/light background                │       │          │
│  │ │ • Recent photo (within 6 months)        │       │          │
│  │ │ • Formal attire                         │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Signature:                                        │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ [Upload Signature] or [Digital Signature]│      │          │
│  │ │                                         │       │          │
│  │ │ [ Signature Preview ]                   │       │          │
│  │ │                                         │       │          │
│  │ │ (will be used in prescriptions, reports)│       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Biometric Enrollment:                             │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ [  Fingerprint Scanner Active  ]        │       │          │
│  │ │                                         │       │          │
│  │ │ [✓] Right Thumb                         │       │          │
│  │ │ [✓] Left Thumb                          │       │          │
│  │ │ [ ] Right Index (backup)                │       │          │
│  │ │                                         │       │          │
│  │ │ (Used for attendance & access control)  │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 16: REVIEW & CONFIRMATION                                  │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Profile Summary:                                  │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Employee: Dr. Rajesh Kumar Sharma       │       │          │
│  │ │ Employee Code: (will be generated)      │       │          │
│  │ │ Designation: Consultant Cardiologist    │       │          │
│  │ │ Department: Cardiology OPD              │       │          │
│  │ │ Employment: Consultant                  │       │          │
│  │ │ Joining: 01-Jan-2025                    │       │          │
│  │ │                                         │       │          │
│  │ │ Credentials: ✓ All Verified             │       │          │
│  │ │ Background Check: ✓ Cleared             │       │          │
│  │ │ Medical Fitness: ✓ Fit for Duty         │       │          │
│  │ │ System Access: ✓ Will be created        │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Pre-Joining Checklist:                            │          │
│  │ [✓] All mandatory documents collected             │          │
│  │ [✓] Background verification cleared               │          │
│  │ [✓] Medical fitness confirmed                     │          │
│  │ [✓] Professional credentials verified             │          │
│  │ [✓] Insurance coverage confirmed                  │          │
│  │ [✓] Bank details verified                         │          │
│  │                                                   │          │
│  │ [Back] [Save as Draft] [Create Staff Profile]     │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 17: POST-CREATION ACTIONS                                  │
│  ┌───────────────────────────────────────────────────┐          │
│  │ ✓ Staff Profile Created!                          │          │
│  │                                                   │          │
│  │ Employee Code: EMP-BLR-CARD-0042                  │          │
│  │                                                   │          │
│  │ System Actions Completed:                         │          │
│  │ [✓] Staff record created                          │          │
│  │ [✓] Employee code generated                       │          │
│  │ [✓] User account created                          │          │
│  │ [✓] Credentials sent to email                     │          │
│  │ [✓] Department assignment recorded                │          │
│  │ [✓] Employee health record initialized            │          │
│  │ [✓] Credential tracking activated                 │          │
│  │ [✓] Privilege records created                     │          │
│  │ [✓] Leave balance initialized                     │          │
│  │ [✓] Activity log generated                        │          │
│  │                                                   │          │
│  │ Next Steps:                                       │          │
│  │ • Schedule orientation & training                 │          │
│  │ • Issue ID card & access card                     │          │
│  │ • Assign workstation/locker                       │          │
│  │ • Setup OPD schedule (for doctors)                │          │
│  │ • Add to department rosters                       │          │
│  │                                                   │          │
│  │ [View Staff Profile] [Print Welcome Letter]       │          │
│  │ [Schedule Orientation] [Close]                    │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Credential Management Workflow

### 4.1 Credential Addition Flow

[Content continues in next part due to length...]

### 4.2 Credential Expiry Tracking & Alerts

```
CREDENTIAL EXPIRY MANAGEMENT SYSTEM

AUTOMATED ALERT SYSTEM:
┌──────────────────────────────────────────────────────────┐
│ Alert Trigger Schedule:                                  │
│                                                           │
│ 90 Days Before Expiry:                                   │
│   • Email to staff member                                │
│   • Email to HOD/Department Admin                        │
│   • Dashboard alert (Yellow)                             │
│   • System notification                                  │
│                                                           │
│ 60 Days Before Expiry:                                   │
│   • Reminder email to staff                              │
│   • Escalation to HR                                     │
│   • Dashboard alert (Orange)                             │
│                                                           │
│ 30 Days Before Expiry:                                   │
│   • Final reminder email                                 │
│   • Escalation to Branch Admin                           │
│   • Dashboard alert (Red)                                │
│   • SMS alert to staff                                   │
│                                                           │
│ 15 Days Before Expiry:                                   │
│   • Daily email reminders                                │
│   • System flags for approval workflows                  │
│   • HOD review required                                  │
│                                                           │
│ 7 Days Before Expiry:                                    │
│   • Critical alert - daily emails                        │
│   • System blocks certain functions (configurable)       │
│   • Executive management notification                    │
│                                                           │
│ On Expiry Date:                                          │
│   • Auto-update credential status to "EXPIRED"           │
│   • Block related privileges                             │
│   • Suspend system access (for critical credentials)     │
│   • Generate compliance report                           │
│                                                           │
│ Post-Expiry:                                             │
│   • Daily escalation emails                              │
│   • Compliance team notification                         │
│   • Consider staff on "restricted duty"                  │
└──────────────────────────────────────────────────────────┘

RENEWAL WORKFLOW:
┌──────────────────────────────────────────────────────────┐
│ 1. Staff receives renewal alert                          │
│ 2. Staff initiates renewal with authority                │
│ 3. Staff uploads new certificate/renewal receipt         │
│ 4. System creates renewal tracking record                │
│ 5. HR verifies renewed credential                        │
│ 6. System updates:                                       │
│    • Last renewal date                                   │
│    • New expiry date                                     │
│    • Certificate URL                                     │
│    • Credential status → VALID                           │
│    • Restores privileges if suspended                    │
│ 7. Confirmation email sent                               │
│ 8. Audit log updated                                     │
└──────────────────────────────────────────────────────────┘
```

### 4.3 ABDM HPR Verification Workflow

```
ABDM HPR AUTO-VERIFICATION PROCESS

For New Doctors:
┌──────────────────────────────────────────────────────────┐
│ 1. Doctor profile created with MCI registration number   │
│ 2. System automatically calls ABDM HPR API:              │
│    - Endpoint: /api/v1/hpr/search                        │
│    - Search by: MCI registration number                  │
│                                                           │
│ 3. API Response Scenarios:                               │
│    ┌─────────────────────────────────────────────────┐   │
│    │ FOUND & VERIFIED:                               │   │
│    │  • HPR ID populated                             │   │
│    │  • Professional details validated               │   │
│    │  • Qualification details matched                │   │
│    │  • Specialty verified                           │   │
│    │  • Status: VERIFIED                             │   │
│    │  • Green checkmark shown                        │   │
│    └─────────────────────────────────────────────────┘   │
│                                                           │
│    ┌─────────────────────────────────────────────────┐   │
│    │ FOUND BUT MISMATCH:                            │   │
│    │  • HPR ID found but details don't match        │   │
│    │  • Status: PENDING_VERIFICATION                │   │
│    │  • Flag for HR manual review                   │   │
│    │  • Alert: "Please verify doctor credentials"   │   │
│    └─────────────────────────────────────────────────┘   │
│                                                           │
│    ┌─────────────────────────────────────────────────┐   │
│    │ NOT FOUND:                                     │   │
│    │  • Doctor not registered in HPR                │   │
│    │  • Status: NOT_FOUND                           │   │
│    │  • Recommendation to doctor: Register at HPR  │   │
│    │  • Manual verification required                │   │
│    └─────────────────────────────────────────────────┘   │
│                                                           │
│ 4. Verification stored in database:                      │
│    - hpr_id                                              │
│    - hpr_verification_status                             │
│    - hpr_last_verified_date                              │
│    - hpr_verification_response (full JSON)               │
│                                                           │
│ 5. Re-verification Schedule:                             │
│    - Automatic re-verification every 6 months            │
│    - Manual re-verify option available                   │
│    - Alert if status changes                             │
└──────────────────────────────────────────────────────────┘

