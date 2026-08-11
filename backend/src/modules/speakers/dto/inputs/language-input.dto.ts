import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { LanguageProficiency } from '@prisma/client';

export class LanguageInputDto {
  @IsInt()
  languageId!: number;

  @IsOptional()
  @IsEnum(LanguageProficiency)
  proficiency?: LanguageProficiency;

  @IsOptional()
  @IsBoolean()
  canPresent?: boolean;

  @IsOptional()
  @IsBoolean()
  canQa?: boolean;

  @IsOptional()
  @IsBoolean()
  canModerate?: boolean;
}
