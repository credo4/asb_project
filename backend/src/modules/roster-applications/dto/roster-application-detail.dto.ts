import { ApplicationStatus } from '@prisma/client';
import {
  AdminRefDto,
  ConvertedSpeakerRefDto,
  ConvertedUserRefDto,
} from './outputs/reference.dto';
import { RosterApplicationEvaluationDto } from './outputs/evaluation.dto';
import { RosterApplicationAttachmentDto } from './outputs/attachment.dto';

// Projection COMPLÈTE réservée à l'admin (route déjà restreinte à
// ADMIN/SUPER_ADMIN — voir RosterApplicationsController). Inclut l'intake
// d'origine (immuable), les évaluations de chaque admin (strictement
// interne — CLAUDE.md §5), et les pièces jointes.
export class RosterApplicationDetailDto {
  id!: number;
  reference!: string;
  status!: ApplicationStatus;
  statusChangedAt!: Date | null;

  // --- Intake d'origine (immuable) ---
  fullName!: string;
  jobTitle!: string | null;
  organization!: string | null;
  country!: string | null;
  workEmail!: string;
  phone!: string | null;
  linkedinUrl!: string | null;
  expertiseArea!: string | null;
  keyTopics!: string | null;
  message!: string | null;
  gdprConsent!: boolean;

  // --- Traitement interne ---
  assignedAdmin!: AdminRefDto | null;
  interviewScheduledAt!: Date | null;
  interviewNotes!: string | null;
  rejectionReason!: string | null;

  evaluations!: RosterApplicationEvaluationDto[];
  // null = pas encore évaluée.
  aggregatedScore!: number | null;

  attachments!: RosterApplicationAttachmentDto[];

  // Signale (ne bloque pas) — voir RosterApplicationListItemDto.
  hasDuplicateEmail!: boolean;

  // --- Conversion (§4) ---
  convertedSpeaker!: ConvertedSpeakerRefDto | null;
  convertedUser!: ConvertedUserRefDto | null;
  convertedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}
