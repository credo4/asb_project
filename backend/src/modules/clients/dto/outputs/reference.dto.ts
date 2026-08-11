import { BookingStatus, ServiceType } from '@prisma/client';

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
