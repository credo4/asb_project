import { ApplicationStatus } from '@prisma/client';
import { AdminRefDto } from './outputs/reference.dto';

// §5.1 — colonnes : identité, fonction, organisation, pays, expertise,
// LinkedIn, date de soumission, statut, admin responsable, score agrégé.
export class RosterApplicationListItemDto {
  id!: number;
  reference!: string;
  status!: ApplicationStatus;

  fullName!: string;
  jobTitle!: string | null;
  organization!: string | null;
  country!: string | null;
  expertiseArea!: string | null;
  linkedinUrl!: string | null;
  workEmail!: string;

  assignedAdmin!: AdminRefDto | null;
  // null = pas encore évaluée (jamais 0 — voir aggregated-score.util.ts).
  aggregatedScore!: number | null;

  // Signale (ne bloque pas — §5.1) : l'email correspond à une AUTRE
  // candidature déjà en base, ou à un speaker existant.
  hasDuplicateEmail!: boolean;

  createdAt!: Date;
}

export class RosterApplicationListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class RosterApplicationListResponseDto {
  data!: RosterApplicationListItemDto[];
  meta!: RosterApplicationListMetaDto;
}
