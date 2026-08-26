// Mêmes bornes que booking_request_attachments (§7 — "réutilise
// intégralement la brique de la 2c").
export const MISSION_DOCUMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo

export const MISSION_DOCUMENT_SUBDIR = 'mission-documents';

export const MISSION_DOCUMENT_EXTENSION_BY_MIME: Record<string, string> = {
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
