import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Length, Matches } from "class-validator";

export const STAFF_ASSET_KINDS = ["PROFILE_PHOTO", "SIGNATURE", "IDENTITY_DOC"] as const;
export type StaffAssetKind = (typeof STAFF_ASSET_KINDS)[number];

/**
 * Multipart upload DTO.
 *
 * Notes:
 * - `contextId` is typically the onboarding `draftId` (UUID) today.
 * - In future, you can send `staffId` instead once you create the Staff record early.
 */
export class UploadStaffAssetDto {
  @ApiProperty({
    description: "Context identifier used for foldering (draftId / staffId).",
    example: "88ff806a-f404-4443-8474-d5d416eecda2",
  })
  @IsString()
  @Length(6, 120)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: "contextId can contain only letters, numbers, dot, underscore, hyphen",
  })
  contextId!: string;

  @ApiProperty({ description: "What is being uploaded", enum: STAFF_ASSET_KINDS })
  @IsString()
  @IsIn(STAFF_ASSET_KINDS)
  kind!: StaffAssetKind;
}

export type UploadResult = {
  key: string;
  url: string;
  mime: string;
  sizeBytes: number;
  checksumSha256: string;
};
