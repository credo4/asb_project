import { MediaAdminRow, MediaRow } from '../speaker-media.includes';
import { SpeakerMediaItemDto } from '../dto/outputs/speaker-media-item.dto';
import { AdminMediaItemDto } from '../dto/outputs/admin-media-item.dto';

export function toOwnDto(row: MediaRow): SpeakerMediaItemDto {
  return {
    id: row.id,
    type: row.type,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    title: row.title,
    caption: row.caption,
    displayOrder: row.displayOrder,
    status: row.status,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
  };
}

export function toAdminDto(row: MediaAdminRow): AdminMediaItemDto {
  return {
    id: row.id,
    speaker: {
      id: row.speaker.id,
      displayName:
        row.speaker.publicName ??
        `${row.speaker.firstName} ${row.speaker.lastName}`,
    },
    type: row.type,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    title: row.title,
    caption: row.caption,
    displayOrder: row.displayOrder,
    status: row.status,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy
      ? { id: row.reviewedBy.id, email: row.reviewedBy.email }
      : null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
  };
}

// Résumé restreint pour le journal d'activité.
export function scalarSnapshot(row: MediaRow): Record<string, unknown> {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    displayOrder: row.displayOrder,
  };
}
