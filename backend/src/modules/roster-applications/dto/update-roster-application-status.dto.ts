import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

// PATCH /admin/roster-applications/:id/status — validé contre la matrice
// centralisée (roster-application-status-transitions.util.ts). N'accepte
// JAMAIS INFO_REQUESTED, REJECTED ou CONVERTED comme cible : ces trois
// transitions ont leurs propres endpoints dédiés, avec des effets de bord
// (email, motif obligatoire, conversion) que ce DTO générique ne porte pas —
// voir RosterApplicationsService#updateStatus pour le message d'erreur qui
// redirige vers le bon endpoint.
export class UpdateRosterApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  // Utilisés seulement pour les transitions vers INTERVIEW_TO_SCHEDULE /
  // INTERVIEW_DONE — ignorés silencieusement sinon.
  @IsOptional()
  @IsDateString()
  interviewScheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  interviewNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
