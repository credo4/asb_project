import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// POST /admin/roster-applications/:id/reject (§3) — passage en REJECTED.
// `rejectionReason` obligatoire (usage interne). `sendRejectionEmail` est une
// case à cocher EXPLICITE — PAS de valeur par défaut (@IsBoolean sans
// @IsOptional exige que le champ soit fourni) : un changement de statut par
// erreur ne doit jamais envoyer un refus irrattrapable au candidat.
export class RejectRosterApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rejectionReason!: string;

  @IsBoolean()
  sendRejectionEmail!: boolean;
}
