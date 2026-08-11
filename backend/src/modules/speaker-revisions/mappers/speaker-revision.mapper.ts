import { SpeakerRevisionRow } from '../speaker-revisions.includes';
import { SpeakerRevisionSummaryDto } from '../dto/outputs/speaker-revision-summary.dto';
import { SpeakerRevisionListItemDto } from '../dto/outputs/speaker-revision-list-item.dto';
import { SpeakerRevisionPayloadDto } from '../dto/speaker-revision-payload.dto';
import { AdminRefDto, SpeakerRefDto } from '../dto/outputs/reference.dto';

function displayNameOf(speaker: {
  publicName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`;
}

export function toSpeakerRef(
  speaker: SpeakerRevisionRow['speaker'],
): SpeakerRefDto {
  return {
    id: speaker.id,
    displayName: displayNameOf(speaker),
    slug: speaker.slug,
  };
}

export function toAdminRef(
  admin: SpeakerRevisionRow['reviewedBy'],
): AdminRefDto | null {
  if (!admin) return null;
  return {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
  };
}

export function toSummaryDto(
  row: SpeakerRevisionRow,
): SpeakerRevisionSummaryDto {
  return {
    id: row.id,
    status: row.status,
    payload: row.payload as SpeakerRevisionPayloadDto,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewerComment: row.reviewerComment,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toListItemDto(
  row: SpeakerRevisionRow,
): SpeakerRevisionListItemDto {
  return {
    id: row.id,
    speaker: toSpeakerRef(row.speaker),
    status: row.status,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Résumé restreint pour le journal d'activité.
export function scalarSnapshot(
  row: SpeakerRevisionRow,
): Record<string, unknown> {
  return {
    id: row.id,
    speakerId: row.speakerId,
    status: row.status,
    reviewedById: row.reviewedById,
    updatedAt: row.updatedAt,
  };
}
