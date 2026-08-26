import { MissionDocument, User } from '@prisma/client';
import { MissionDocumentDto } from '../dto/outputs/mission-document.dto';

type Row = MissionDocument & { uploadedBy: Pick<User, 'email'> | null };

export function toDocumentDto(row: Row): MissionDocumentDto {
  return {
    id: row.id,
    type: row.type,
    isSharedWithSpeaker: row.isSharedWithSpeaker,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedByRole: row.uploadedByRole,
    uploadedByEmail: row.uploadedBy?.email ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
