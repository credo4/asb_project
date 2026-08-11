import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { OneToOnePurpose, ServiceType } from '@prisma/client';
import {
  AUDIENCE_SIZE_SERVICE_TYPES,
  EVENT_DETAIL_SERVICE_TYPES,
  EVENT_FORMATS_BY_SERVICE,
  ONE_TO_ONE_SERVICE_TYPES,
} from '../booking-request.constants';

// class-validator ne connaît pas nativement les "DTO discriminés" (une seule
// classe couvre les 5 formulaires, cf. schéma `booking_requests` unifié) :
// `@ValidateIf` permet de rendre un champ obligatoire SEULEMENT quand
// `serviceType` appartient au bon groupe, sans disperser cette logique dans
// des `if` du service — la règle de validation reste lisible ICI, au même
// endroit que le champ qu'elle concerne.
@ValidatorConstraint({ name: 'eventFormatForService', async: false })
class EventFormatForServiceConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const dto = args.object as CreateBookingRequestDto;
    const allowed = EVENT_FORMATS_BY_SERVICE[dto.serviceType] ?? [];
    return allowed.includes(value);
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as CreateBookingRequestDto;
    const allowed = EVENT_FORMATS_BY_SERVICE[dto.serviceType] ?? [];
    return `eventFormat doit être l'une des valeurs suivantes pour ${dto.serviceType} : ${allowed.join(', ')}.`;
  }
}

export class CreateBookingRequestDto {
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  // --- Contact (communs à tous les services) ---
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  // organization est requis pour les 5 services (cf. cahier des charges §4) :
  // pas de @ValidateIf, c'est un champ obligatoire simple.
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organization!: string;

  @ValidateIf((o: CreateBookingRequestDto) =>
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

  @ValidateIf((o: CreateBookingRequestDto) =>
    ONE_TO_ONE_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  websiteOrLinkedin?: string;

  // --- Événement (CONFERENCE / MASTERCLASS / WEBINAR / ADVISORY) ---
  @ValidateIf((o: CreateBookingRequestDto) =>
    EVENT_DETAIL_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  eventName?: string;

  @ValidateIf((o: CreateBookingRequestDto) =>
    EVENT_DETAIL_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsDateString()
  eventDate?: string;

  @ValidateIf((o: CreateBookingRequestDto) =>
    EVENT_DETAIL_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  eventLocation?: string;

  @ValidateIf((o: CreateBookingRequestDto) =>
    EVENT_DETAIL_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @Validate(EventFormatForServiceConstraint)
  eventFormat?: string;

  @ValidateIf((o: CreateBookingRequestDto) =>
    AUDIENCE_SIZE_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  audienceSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sessionLength?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  language?: string;

  @ValidateIf((o: CreateBookingRequestDto) =>
    EVENT_DETAIL_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  primaryTopics?: string;

  @ValidateIf((o: CreateBookingRequestDto) =>
    EVENT_DETAIL_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  goals?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  speakerPreferences?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  estimatedBudget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  additionalComments?: string;

  // --- Spécifique ONE_TO_ONE ---
  @ValidateIf((o: CreateBookingRequestDto) =>
    ONE_TO_ONE_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsEnum(OneToOnePurpose)
  visitPurpose?: OneToOnePurpose;

  @ValidateIf((o: CreateBookingRequestDto) =>
    ONE_TO_ONE_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  keyQuestions?: string;

  @ValidateIf((o: CreateBookingRequestDto) =>
    ONE_TO_ONE_SERVICE_TYPES.includes(o.serviceType),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  preferredTime?: string;

  // Pré-rempli via le bouton "Check Availability" du site public. S'il ne
  // correspond à aucun speaker publié, il est ignoré silencieusement par le
  // service plutôt que de faire échouer toute la soumission (cf. §3).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requestedSpeakerId?: number;

  @IsBoolean()
  @Equals(true, {
    message: 'Le consentement RGPD (gdprConsent) est requis.',
  })
  gdprConsent!: boolean;

  // --- Consentement/origine (Phase 3b, §3) — TRANSITION DOUCE ---
  // Le site public ne renvoie pas encore ces deux champs : OPTIONNELS tant
  // que REQUIRE_CONSENT (booking-request.constants.ts) vaut false, pour ne
  // pas casser l'intégration existante. Une soumission sans ces champs est
  // acceptée et journalise un avertissement (voir
  // BookingRequestsService#createFromPublic).
  @IsOptional()
  @IsDateString()
  consentGivenAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  consentVersion?: string;

  // Honeypot anti-bot : un formulaire humain laisse ce champ vide (il est
  // caché en CSS côté site public). Jamais documenté dans Swagger.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website2?: string;
}
