import { BadRequestException } from '@nestjs/common';
import { ALLOWED_VIDEO_EMBED_HOSTS } from './speaker-media.constants';

// Empêche d'injecter une URL arbitraire dans une iframe côté front (le site
// public embarque `url` telle quelle) : seuls les domaines d'hébergement
// vidéo connus sont acceptés, en HTTPS, avec correspondance exacte de host
// (pas de simple `.includes('youtube.com')`, contournable par
// "youtube.com.evil.example").
export function assertAllowedVideoEmbedUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('"url" doit être une URL valide.');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('"url" doit être en HTTPS.');
  }

  if (!ALLOWED_VIDEO_EMBED_HOSTS.includes(parsed.hostname)) {
    throw new BadRequestException(
      `Domaine vidéo non autorisé : "${parsed.hostname}". Domaines acceptés : YouTube, Vimeo.`,
    );
  }
}
