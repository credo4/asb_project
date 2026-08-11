import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateRosterApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  organization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @IsEmail()
  @MaxLength(191)
  workEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  expertiseArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  keyTopics?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  @IsBoolean()
  @Equals(true, {
    message: 'Le consentement RGPD (gdprConsent) est requis.',
  })
  gdprConsent!: boolean;

  // Honeypot anti-bot — voir CreateBookingRequestDto.website2.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website2?: string;
}
