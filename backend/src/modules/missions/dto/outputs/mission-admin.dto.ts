import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MissionContractStatus,
  MissionLogisticsStatus,
  MissionPaymentStatus,
  MissionStatus,
  ServiceType,
} from '@prisma/client';
import {
  MissionBookingRequestRefDto,
  MissionOrganizationRefDto,
  MissionSpeakerRefDto,
} from './mission-refs.dto';
import { MissionChecklistItemDto } from './mission-checklist-item.dto';
import { MissionDocumentDto } from './mission-document.dto';
import { MissionMessageDto } from './mission-message.dto';

// Vue ADMIN — interne, AUCUNE restriction de champ (à la différence de
// MissionSpeakerDetailDto, voir §5).
export class MissionAdminListItemDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  reference!: string;

  @ApiProperty({ type: MissionSpeakerRefDto })
  speaker!: MissionSpeakerRefDto;

  @ApiProperty({ type: MissionBookingRequestRefDto })
  bookingRequest!: MissionBookingRequestRefDto;

  @ApiPropertyOptional({ type: MissionOrganizationRefDto, nullable: true })
  organization!: MissionOrganizationRefDto | null;

  @ApiProperty({ enum: ServiceType })
  serviceType!: ServiceType;

  @ApiProperty()
  eventDate!: string;

  @ApiProperty({ enum: MissionStatus })
  status!: MissionStatus;

  @ApiProperty({ enum: MissionContractStatus })
  contractStatus!: MissionContractStatus;

  @ApiProperty({ enum: MissionPaymentStatus })
  paymentStatus!: MissionPaymentStatus;

  @ApiProperty({ enum: MissionLogisticsStatus })
  logisticsStatus!: MissionLogisticsStatus;

  @ApiProperty()
  isVirtual!: boolean;

  @ApiPropertyOptional({ nullable: true })
  locationCountryName!: string | null;

  // Calculé à la lecture (jamais stocké), même principe que sur le détail
  // — voir composeAdminDetail(). Ajouté pour la colonne "avancement de la
  // checklist" de la liste back-office.
  @ApiProperty()
  checklistProgressPercent!: number;
}

export class MissionListResponseDto {
  @ApiProperty({ type: [MissionAdminListItemDto] })
  data!: MissionAdminListItemDto[];

  @ApiProperty()
  meta!: { total: number; page: number; perPage: number };
}

export class MissionAdminDetailDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  reference!: string;

  @ApiProperty({ type: MissionSpeakerRefDto })
  speaker!: MissionSpeakerRefDto;

  @ApiProperty({ type: MissionBookingRequestRefDto })
  bookingRequest!: MissionBookingRequestRefDto;

  @ApiPropertyOptional({ type: MissionOrganizationRefDto, nullable: true })
  organization!: MissionOrganizationRefDto | null;

  @ApiProperty({ enum: ServiceType })
  serviceType!: ServiceType;

  @ApiProperty()
  eventDate!: string;

  @ApiPropertyOptional({ nullable: true })
  startTime!: string | null;

  @ApiPropertyOptional({ nullable: true })
  endTime!: string | null;

  @ApiPropertyOptional({ nullable: true })
  timezone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  locationCountryName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  address!: string | null;

  @ApiProperty()
  isVirtual!: boolean;

  @ApiPropertyOptional({ nullable: true })
  virtualLink!: string | null;

  @ApiPropertyOptional({ nullable: true })
  onSiteContactName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  onSiteContactPhone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  durationMinutes!: number | null;

  @ApiProperty()
  topic!: string;

  @ApiPropertyOptional({ nullable: true })
  language!: string | null;

  @ApiPropertyOptional({ nullable: true })
  format!: string | null;

  @ApiPropertyOptional({ nullable: true })
  participantCount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  clientAmount!: string | null;

  @ApiPropertyOptional({ nullable: true })
  speakerAmount!: string | null;

  @ApiPropertyOptional({ nullable: true })
  agencyCommission!: string | null;

  @ApiPropertyOptional({ nullable: true })
  expenses!: string | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: MissionStatus })
  status!: MissionStatus;

  @ApiProperty({ enum: MissionContractStatus })
  contractStatus!: MissionContractStatus;

  @ApiProperty({ enum: MissionPaymentStatus })
  paymentStatus!: MissionPaymentStatus;

  @ApiProperty({ enum: MissionLogisticsStatus })
  logisticsStatus!: MissionLogisticsStatus;

  @ApiPropertyOptional({ nullable: true })
  internalNotes!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancellationReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  acceptedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  briefAcknowledgedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: [MissionChecklistItemDto] })
  checklist!: MissionChecklistItemDto[];

  @ApiProperty()
  checklistProgressPercent!: number;

  @ApiProperty({ type: [MissionDocumentDto] })
  documents!: MissionDocumentDto[];

  @ApiProperty({ type: [MissionMessageDto] })
  messages!: MissionMessageDto[];
}
