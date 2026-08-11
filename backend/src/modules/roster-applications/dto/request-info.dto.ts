import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// POST /admin/roster-applications/:id/request-info (§3) — passage en
// INFO_REQUESTED. Le message est repris tel quel dans l'email templaté
// envoyé au candidat ; l'envoi est journalisé (destinataire, date, contenu —
// voir ActivityLogService, action 'roster_application.info_requested').
export class RequestInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;
}
