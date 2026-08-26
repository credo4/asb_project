import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// PATCH /admin/settings (SUPER_ADMIN, §A4) — tous les champs optionnels :
// une modification ne touche que les champs envoyés, jamais un "reset" des
// autres (même philosophie que UpdateOrganizationDto). ⚠️ responseSlaBusinessDays
// ne s'applique QU'AUX NOUVELLES demandes créées après la modification —
// voir AppSettingsService/BookingRequestsService, jamais un recalcul des
// demandes existantes.
export class UpdateAppSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  agencyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  teamEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  responseSlaBusinessDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  collaborationTermsVersion?: string;
}
