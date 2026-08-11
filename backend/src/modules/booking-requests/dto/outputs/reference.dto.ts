// Petites projections utilisées dans les DTOs de sortie admin (jamais
// l'entité Prisma brute — voir modules/speakers/dto/outputs/reference.dto.ts
// pour le même principe).
import { BookingStatus, ServiceType } from '@prisma/client';

export class RequestedSpeakerRefDto {
  id!: number;
  displayName!: string;
  slug!: string | null;
}

export class AdminRefDto {
  id!: number;
  email!: string;
  firstName!: string | null;
  lastName!: string | null;
}

// Rattachement CRM (Phase 3, §3a) — voir CLAUDE.md : distinct des champs
// d'intake bruts (fullName/workEmail/organization) exposés par ailleurs sur
// ce même DTO, jamais fusionné avec eux.
export class LinkedContactRefDto {
  id!: number;
  firstName!: string;
  lastName!: string;
  email!: string;
}

export class LinkedOrganizationRefDto {
  id!: number;
  name!: string;
}

// §6.2 — "Historique des autres demandes du même contact/de la même
// organisation", affiché dans la vue détail. Projection légère, pas le DTO
// détail complet (éviterait une récursion et charge inutile de champs).
export class SiblingBookingRequestRefDto {
  id!: number;
  reference!: string;
  serviceType!: ServiceType;
  status!: BookingStatus;
  createdAt!: Date;
}
