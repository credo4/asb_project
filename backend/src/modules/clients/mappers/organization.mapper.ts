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

// "Dernière activité" (§1 du prompt Clients) : la plus récente des trois
// dates disponibles — jamais stockée, recalculée à chaque lecture, même
// principe que checklistProgressPercent (module Missions).
function toLastActivityAt(row: OrganizationListRow): Date | null {
  const candidates = [
    row.updatedAt,
    row.bookingRequests[0]?.createdAt,
    row.missions[0]?.createdAt,
  ].filter((d): d is Date => d instanceof Date);
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, d) => (d > latest ? d : latest));
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
    bookingRequestsCount: row._count.bookingRequests,
    missionsCount: row._count.missions,
    lastActivityAt: toLastActivityAt(row),
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
    missions: row.missions.map((m) => ({
      id: m.id,
      reference: m.reference,
      status: m.status,
      eventDate: m.eventDate,
      speaker: {
        id: m.speaker.id,
        displayName:
          m.speaker.publicName ??
          `${m.speaker.firstName} ${m.speaker.lastName}`,
      },
    })),
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
