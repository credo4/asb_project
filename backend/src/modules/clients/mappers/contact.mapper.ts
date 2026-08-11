import { ContactDetailRow, ContactListRow } from '../clients.includes';
import { ContactListItemDto } from '../dto/outputs/contact-list-item.dto';
import { ContactDetailDto } from '../dto/outputs/contact-detail.dto';
import {
  CountryRefDto,
  OrganizationRefDto,
} from '../dto/outputs/reference.dto';

function toOrganizationRef(
  organization: ContactListRow['organization'],
): OrganizationRefDto | null {
  if (!organization) return null;
  return { id: organization.id, name: organization.name };
}

function toCountryRef(
  country: ContactListRow['country'],
): CountryRefDto | null {
  if (!country) return null;
  return { id: country.id, name: country.name, iso2: country.iso2 };
}

export function toListItemDto(row: ContactListRow): ContactListItemDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    jobTitle: row.jobTitle,
    organization: toOrganizationRef(row.organization),
    country: toCountryRef(row.country),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDetailDto(row: ContactDetailRow): ContactDetailDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    jobTitle: row.jobTitle,
    organization: toOrganizationRef(row.organization),
    country: toCountryRef(row.country),
    internalNotes: row.internalNotes,
    bookingRequests: row.bookingRequests,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Résumé restreint pour le journal d'activité.
export function scalarSnapshot(row: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  organizationId: number | null;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    organizationId: row.organizationId,
    updatedAt: row.updatedAt,
  };
}
