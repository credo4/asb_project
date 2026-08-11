import {
  OrganizationDetailRow,
  OrganizationListRow,
} from '../clients.includes';
import { OrganizationListItemDto } from '../dto/outputs/organization-list-item.dto';
import { OrganizationDetailDto } from '../dto/outputs/organization-detail.dto';
import { AdminRefDto, CountryRefDto } from '../dto/outputs/reference.dto';

function toAdminRef(
  admin: OrganizationListRow['assignedAdmin'],
): AdminRefDto | null {
  if (!admin) return null;
  return {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
  };
}

function toCountryRef(
  country: OrganizationListRow['country'],
): CountryRefDto | null {
  if (!country) return null;
  return { id: country.id, name: country.name, iso2: country.iso2 };
}

export function toListItemDto(
  row: OrganizationListRow,
): OrganizationListItemDto {
  return {
    id: row.id,
    name: row.name,
    sector: row.sector,
    country: toCountryRef(row.country),
    website: row.website,
    assignedAdmin: toAdminRef(row.assignedAdmin),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDetailDto(row: OrganizationDetailRow): OrganizationDetailDto {
  return {
    id: row.id,
    name: row.name,
    sector: row.sector,
    country: toCountryRef(row.country),
    website: row.website,
    internalNotes: row.internalNotes,
    assignedAdmin: toAdminRef(row.assignedAdmin),
    contacts: row.contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      jobTitle: c.jobTitle,
    })),
    bookingRequests: row.bookingRequests,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Résumé restreint pour le journal d'activité (mêmes principes que
// SpeakersService#scalarSnapshot).
export function scalarSnapshot(row: {
  id: number;
  name: string;
  sector: string | null;
  assignedAdminId: number | null;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    sector: row.sector,
    assignedAdminId: row.assignedAdminId,
    updatedAt: row.updatedAt,
  };
}
