import { BookingPriority, BookingStatus, ServiceType } from '@prisma/client';
import { AdminRefDto } from './outputs/reference.dto';

// Projection LÉGÈRE pour la liste inbox (§4 — colonnes du §6.1) — pas les
// champs de contenu détaillé du formulaire (goals, speakerPreferences...),
// réservés à la vue détail.
export class BookingRequestListItemDto {
  id!: number;
  reference!: string;
  serviceType!: ServiceType;
  status!: BookingStatus;
  priority!: BookingPriority;
  fullName!: string;
  organization!: string;
  workEmail!: string;
  eventName!: string | null;
  eventDate!: Date | null;
  eventLocation!: string | null;
  estimatedBudget!: string | null;
  assignedAdmin!: AdminRefDto | null;
  responseDueAt!: Date | null;
  // Calculé (jamais stocké) : responseDueAt dépassé ET firstRespondedAt vide.
  isOverdue!: boolean;
  createdAt!: Date;
}

export class BookingRequestListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class BookingRequestListResponseDto {
  data!: BookingRequestListItemDto[];
  meta!: BookingRequestListMetaDto;
}
