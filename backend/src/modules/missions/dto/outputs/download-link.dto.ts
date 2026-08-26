// Petit DTO dupliqué délibérément (même convention que les autres modules
// de stockage privé du projet — booking-requests, roster-applications,
// speaker-documents) : chaque module a ses propres DTOs de sortie.
export class DownloadLinkDto {
  url!: string;
  expiresAt!: string;
}
