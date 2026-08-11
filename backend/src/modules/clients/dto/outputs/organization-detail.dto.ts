import {
  AdminRefDto,
  BookingRequestRefDto,
  CountryRefDto,
} from './reference.dto';

// Fiche contact minimale telle qu'affichée DANS la fiche organisation (pas
// le ContactDetailDto complet — évite une récursion organisation<->contacts
// inutile, voir A5 : "fiche complète avec l'historique des demandes
// rattachées et ses contacts").
export class OrganizationContactRefDto {
  id!: number;
  firstName!: string;
  lastName!: string;
  email!: string;
  jobTitle!: string | null;
}

// Fiche complète réservée à l'admin (route déjà restreinte ADMIN/SUPER_ADMIN).
export class OrganizationDetailDto {
  id!: number;
  name!: string;
  sector!: string | null;
  country!: CountryRefDto | null;
  website!: string | null;
  internalNotes!: string | null;
  assignedAdmin!: AdminRefDto | null;
  contacts!: OrganizationContactRefDto[];
  bookingRequests!: BookingRequestRefDto[];
  createdAt!: Date;
  updatedAt!: Date;
}
