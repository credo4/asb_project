export const ATTACHMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo, même plafond que speaker_documents

export const ATTACHMENT_SUBDIR = 'booking-request-attachments';

// Extension déduite du mime détecté par contenu — jamais celle fournie par
// le client (voir FileValidationService#detectAllowedType).
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
