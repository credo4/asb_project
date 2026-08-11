// Mêmes plafonds/mapping que booking-request-attachments.constants.ts (Phase
// 3b) — la brique de stockage privé de la Phase 2c est réutilisée à
// l'identique, pas de raison d'avoir des règles différentes ici.
export const ATTACHMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo

export const ATTACHMENT_SUBDIR = 'roster-application-attachments';

export const ATTACHMENT_EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
};
