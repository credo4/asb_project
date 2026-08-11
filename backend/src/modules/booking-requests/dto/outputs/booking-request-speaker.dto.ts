import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingRequestSpeakerStatus } from '@prisma/client';

export class BookingRequestSpeakerSpeakerRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  slug!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profilePhotoUrl!: string | null;
}

export class BookingRequestSpeakerDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ type: BookingRequestSpeakerSpeakerRefDto })
  speaker!: BookingRequestSpeakerSpeakerRefDto;

  @ApiProperty({ enum: BookingRequestSpeakerStatus })
  status!: BookingRequestSpeakerStatus;

  @ApiProperty()
  displayOrder!: number;

  @ApiPropertyOptional({ nullable: true })
  internalNotes!: string | null;

  @ApiPropertyOptional({ nullable: true })
  proposedToClientAt!: string | null;

  @ApiProperty()
  addedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  addedByEmail!: string | null;
}
