import { ConvertedSpeakerRefDto, ConvertedUserRefDto } from './reference.dto';

// Réponse de POST /admin/roster-applications/:id/convert ET
// /:id/attach-existing-user (§4) — confirme ce qui a été créé/rattaché.
export class ConversionResultDto {
  applicationId!: number;
  user!: ConvertedUserRefDto;
  speaker!: ConvertedSpeakerRefDto;
  convertedAt!: Date;
  // Absent (undefined) pour attach-existing-user — aucune invitation émise
  // dans ce cas (le compte existant a déjà (ou pas) un mot de passe, ce
  // n'est pas à cette action de le décider — voir CLAUDE.md §4.3).
  invitationSent?: boolean;
}
