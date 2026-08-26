import { BookingStatus, MissionStatus, ServiceType } from '@prisma/client';

// Petites projections locales à ce module (même principe de duplication
// délibérée qu'ailleurs dans le projet — voir modules/speakers/dto/outputs
// ou modules/booking-requests/dto/outputs : chaque module a ses propres
// DTOs de sortie, jamais un import cross-module de DTO).

export class CountryRefDto {
  id!: number;
  name!: string;
  iso2!: string;
}

export class AdminRefDto {
  id!: number;
  email!: string;
  firstName!: string | null;
  lastName!: string | null;
}

export class OrganizationRefDto {
  id!: number;
  name!: string;
}

// Historique des demandes rattachées, affiché dans la fiche organisation/contact.
export class BookingRequestRefDto {
  id!: number;
  reference!: string;
  serviceType!: ServiceType;
  status!: BookingStatus;
  createdAt!: Date;
}

// Préfixées "Client" pour ne PAS entrer en collision, dans le schéma
// OpenAPI (clé par nom de classe, pas par module), avec
// modules/missions/dto/outputs/mission-refs.dto.ts#MissionSpeakerRefDto
// (shape différente : celle-ci n'a pas besoin de profilePhotoUrl/slug ici).
export class ClientMissionSpeakerRefDto {
  id!: number;
  displayName!: string;
}

// Historique des missions rattachées, affiché dans la fiche organisation
// (gap comblé pour le module Clients, ligne 5.12 — approuvé avant
// modification, même principe que l'extension de GET /admin/missions pour
// le module Missions : on étend un SELECT/DTO existant, pas de nouvelle
// route).
export class ClientMissionRefDto {
  id!: number;
  reference!: string;
  status!: MissionStatus;
  eventDate!: Date;
  speaker!: ClientMissionSpeakerRefDto;
}
