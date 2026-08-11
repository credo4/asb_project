import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  countryId?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  // `null` désassigne explicitement ; absent = inchangé (même convention que
  // UpdateBookingRequestDto#assignedAdminId).
  @IsOptional()
  @ValidateIf((o: UpdateOrganizationDto) => o.assignedAdminId !== null)
  @Type(() => Number)
  @IsInt()
  assignedAdminId?: number | null;
}
