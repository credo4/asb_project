import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

// PATCH /admin/roster-applications/:id/reopen — réservé SUPER_ADMIN. Ne
// fonctionne QUE depuis REJECTED/ARCHIVED (voir
// isApplicationReopenable — CONVERTED est terminal mais N'EST PAS
// réouvrable, un candidat converti a déjà un compte speaker réel). Même
// pattern que ReopenBookingRequestDto (Phase 3b).
export class ReopenRosterApplicationDto {
  @IsEnum(ApplicationStatus)
  targetStatus!: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
