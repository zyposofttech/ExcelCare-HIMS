import { IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

const STAFF_CATEGORY = ["MEDICAL", "NON_MEDICAL"] as const;
const ENGAGEMENT = ["EMPLOYEE", "CONSULTANT", "VISITING", "LOCUM", "CONTRACTOR", "INTERN", "TRAINEE", "VENDOR"] as const;
const ONBOARDING_STATUS = ["DRAFT", "IN_REVIEW", "ACTIVE"] as const;

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  empCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string | null;

  @IsOptional()
  @IsIn(STAFF_CATEGORY as any)
  category?: (typeof STAFF_CATEGORY)[number];

  @IsOptional()
  @IsIn(ENGAGEMENT as any)
  engagementType?: (typeof ENGAGEMENT)[number];

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  hprId?: string | null;

  @IsOptional()
  @IsString()
  homeBranchId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  // ✅ FLEXIBLE onboarding blocks (prevents forbidNonWhitelisted errors)
  @IsOptional() @IsObject() personal_details?: Record<string, any>;
  @IsOptional() @IsObject() contact_details?: Record<string, any>;
  @IsOptional() @IsObject() employment_details?: Record<string, any>;
  @IsOptional() @IsObject() medical_details?: Record<string, any>;
  @IsOptional() @IsObject() system_access?: Record<string, any>;

  // Direct JSON patches
  @IsOptional() @IsObject() personalDetails?: Record<string, any> | null;
  @IsOptional() @IsObject() contactDetails?: Record<string, any> | null;
  @IsOptional() @IsObject() employmentDetails?: Record<string, any> | null;
  @IsOptional() @IsObject() medicalDetails?: Record<string, any> | null;
  @IsOptional() @IsObject() systemAccess?: Record<string, any> | null;

  @IsOptional()
  @IsIn(ONBOARDING_STATUS as any)
  onboardingStatus?: (typeof ONBOARDING_STATUS)[number];

  @IsOptional() @IsString() profilePhotoDocumentId?: string | null;
  @IsOptional() @IsString() signatureDocumentId?: string | null;
  @IsOptional() @IsString() stampDocumentId?: string | null;
}
