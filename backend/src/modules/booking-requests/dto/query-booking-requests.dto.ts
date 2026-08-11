import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { BookingPriority, BookingStatus, ServiceType } from '@prisma/client';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export enum BookingRequestSortBy {
  RECEIVED_AT = 'receivedAt', // createdAt
  EVENT_DATE = 'eventDate',
  PRIORITY = 'priority',
  RESPONSE_DUE_AT = 'responseDueAt',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryBookingRequestsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(BookingPriority)
  priority?: BookingPriority;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedAdminId?: number;

  // Filtre "mes demandes" (§2.1) : ignore toute autre valeur
  // d'assignedAdminId fournie en parallèle, résolu contre `actor.id` côté
  // service — jamais un id fourni par l'appelant pour désigner "moi".
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizationId?: number;

  // Recherche texte : nom, organisation, email, référence.
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // "En retard" : responseDueAt dépassé sans première réponse (isOverdue,
  // §2.5) — remplace l'ancienne définition "non clôturé + responseDueAt
  // dépassé" par la définition officielle introduite en Phase 3b.
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @IsEnum(BookingRequestSortBy)
  sortBy?: BookingRequestSortBy;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
