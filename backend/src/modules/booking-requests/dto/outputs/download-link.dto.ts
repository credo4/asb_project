// Petit DTO dupliqué délibérément (voir modules/speaker-documents/dto/outputs
// pour l'équivalent) : chaque module a ses propres DTOs de sortie.
export class DownloadLinkDto {
  url!: string;
  expiresAt!: string;
}
