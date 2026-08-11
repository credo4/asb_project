import {
  BookingRequestRefDto,
  CountryRefDto,
  OrganizationRefDto,
} from './reference.dto';

// Fiche complète réservée à l'admin (route déjà restreinte ADMIN/SUPER_ADMIN).
export class ContactDetailDto {
  id!: number;
  firstName!: string;
  lastName!: string;
  email!: string;
  phone!: string | null;
  jobTitle!: string | null;
  organization!: OrganizationRefDto | null;
  country!: CountryRefDto | null;
  internalNotes!: string | null;
  bookingRequests!: BookingRequestRefDto[];
  createdAt!: Date;
  updatedAt!: Date;
}
