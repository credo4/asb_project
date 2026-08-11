import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AvailabilityResponseStatus } from '@prisma/client';

export class RespondAvailabilityRequestDto {
  @ApiProperty({ enum: AvailabilityResponseStatus })
  @IsEnum(AvailabilityResponseStatus)
  status!: AvailabilityResponseStatus;

  // Facultatif (§4) — PRIVÉ à l'équipe, jamais transmis au client (§3.1).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  speakerPrivateComment?: string;
}
