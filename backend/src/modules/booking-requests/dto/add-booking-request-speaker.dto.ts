import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddBookingRequestSpeakerDto {
  @ApiProperty()
  @IsInt()
  speakerId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNotes?: string;
}
