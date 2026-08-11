import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

// POST /admin/roster-applications/:id/attach-existing-user (§4.3) — cas où
// un User existe déjà pour l'email de la candidature (speaker déjà au
// roster qui re-candidate, admin qui postule...). L'admin choisit
// EXPLICITEMENT à quel compte rattacher, en connaissance de cause — jamais
// de rattachement automatique par email ici (contrairement à
// ClientLinkingService#resolveAutoLink, ce n'est pas le même contexte :
// convertir un candidat en compte est une décision, pas juste classer une
// demande entrante).
export class AttachExistingUserDto {
  @Type(() => Number)
  @IsInt()
  userId!: number;
}
