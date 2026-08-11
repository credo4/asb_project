import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AvailabilityRequestStatus,
  AvailabilityResponseStatus,
} from '@prisma/client';

// Vue ADMIN — interne, aucune restriction de champ (à la différence de
// AvailabilityRequestBriefingDto, réservé au speaker — voir §3.1).
export class AvailabilityRequestAdminDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  bookingRequestId!: number;

  @ApiProperty()
  speakerId!: number;

  @ApiPropertyOptional({ nullable: true })
  sentByEmail!: string | null;

  @ApiProperty()
  sentAt!: string;

  @ApiProperty()
  respondDueAt!: string;

  @ApiProperty({ enum: AvailabilityRequestStatus })
  status!: AvailabilityRequestStatus;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  eventDate!: string;

  @ApiPropertyOptional({ nullable: true })
  eventEndDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  locationCountryName!: string | null;

  @ApiProperty()
  isVirtual!: boolean;

  @ApiPropertyOptional({ nullable: true })
  durationMinutes!: number | null;

  @ApiProperty()
  topic!: string;

  @ApiPropertyOptional({ nullable: true })
  audienceDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  audienceSize!: string | null;

  @ApiPropertyOptional({ nullable: true })
  language!: string | null;

  @ApiPropertyOptional({ nullable: true })
  proposedFeeAmount!: string | null;

  @ApiPropertyOptional({ nullable: true })
  proposedFeeCurrency!: string | null;

  @ApiPropertyOptional({ nullable: true })
  travelConditions!: string | null;

  @ApiPropertyOptional({ nullable: true })
  additionalNotes!: string | null;

  @ApiPropertyOptional({ enum: AvailabilityResponseStatus, nullable: true })
  responseStatus!: AvailabilityResponseStatus | null;

  @ApiPropertyOptional({ nullable: true })
  respondedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  speakerPrivateComment!: string | null;
}
