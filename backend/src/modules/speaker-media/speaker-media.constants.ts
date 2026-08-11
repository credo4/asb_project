export const MEDIA_QUOTA_PER_SPEAKER = 20;

export const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo
export const PRESS_KIT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo

// Plafond passé à Multer (l'interceptor ne connaît pas encore `type` au
// moment où il applique cette limite — voir speaker-media.controller.ts) :
// le plus large des deux, la limite précise par type est revérifiée dans le
// service une fois `type` et le fichier tous les deux disponibles.
export const MEDIA_UPLOAD_MULTER_LIMIT_BYTES = PRESS_KIT_MAX_SIZE_BYTES;

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

// https:// uniquement, domaines exacts (pas de sous-chaîne) — voir
// video-embed.util.ts.
export const ALLOWED_VIDEO_EMBED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'vimeo.com',
  'www.vimeo.com',
];

export const MEDIA_SUBDIR = 'speaker-media';
