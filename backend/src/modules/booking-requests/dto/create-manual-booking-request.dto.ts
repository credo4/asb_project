import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { OneToOnePurpose, ServiceType } from '@prisma/client';
import {
  AUDIENCE_SIZE_SERVICE_TYPES,
  EVENT_DETAIL_SERVICE_TYPES,
  ONE_TO_ONE_SERVICE_TYPES,
} from '../booking-request.constants';

// « Sollicitations reçues par téléphone ou en personne » (§3) — POST
// /admin/booking-requests, source = MANUAL_ENTRY forcé par le service (pas
// un choix de l'appelant). Mêmes champs d'intake que le formulaire public,
// SANS le honeypot (l'admin n'est pas un bot) et sans exiger `eventFormat`
// dans une allow-list stricte par service : au téléphone, la formulation
// exacte n'est pas garantie identique à celle du site, mieux vaut accepter
// un texte libre que rejeter une saisie légitime.
export class CreateManualBookingRequestDto {
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organization!: string;

  @ValidateIf((o: CreateManualBookingRequestDto) =>
    ONE_TO_ONE_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  jobTitle?: string;

  @IsEmail()
  @MaxLength(191)
  workEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ValidateIf((o: CreateManualBookingRequestDto) =>
    EVENT_DETAIL_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  eventName?: string;

  @ValidateIf((o: CreateManualBookingRequestDto) =>
    EVENT_DETAIL_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsDateString()
  eventDate?: string;

  @ValidateIf((o: CreateManualBookingRequestDto) =>
    EVENT_DETAIL_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  eventLocation?: string;

  // Texte libre ici (pas d'allow-list Validate(EventFormatForServiceConstraint)
  // — voir le commentaire de classe) : le back-office peut saisir la
  // formulation entendue au téléphone sans être bloqué par la liste fermée
  // du formulaire public.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  eventFormat?: string;

  @ValidateIf((o: CreateManualBookingRequestDto) =>
    AUDIENCE_SIZE_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  audienceSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  primaryTopics?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  goals?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  estimatedBudget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  additionalComments?: string;

  @ValidateIf((o: CreateManualBookingRequestDto) =>
    ONE_TO_ONE_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsEnum(OneToOnePurpose)
  visitPurpose?: OneToOnePurpose;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requestedSpeakerId?: number;

  // Verbal, pas de case cochée par le prospect lui-même : l'admin déclare
  // avoir obtenu le consentement (ou pas) au moment de l'appel.
  @IsOptional()
  @IsBoolean()
  gdprConsent?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedAdminId?: number;
}
