import { SpeakerDocument } from '@prisma/client';
import { DocumentAdminRow } from '../speaker-documents.includes';
import { SpeakerDocumentDto } from '../dto/outputs/speaker-document.dto';
import { AdminDocumentDto } from '../dto/outputs/admin-document.dto';

// Type d'entrée volontairement restreint à `Pick<..., sans storageKey>` :
// même si l'appelant passait par erreur un SpeakerDocument complet (qui
// satisferait aussi ce type, storageKey en trop ne gênant personne), ce
// mapper ne LIT jamais row.storageKey — il ne peut donc jamais atterrir dans
// la réponse. Défense en profondeur en plus du `select` explicite côté
// service (speaker-documents.service.ts), qui ne charge même pas la colonne.
type OwnDocumentRow = Pick<
  SpeakerDocument,
  'id' | 'type' | 'originalFilename' | 'mimeType' | 'sizeBytes' | 'uploadedAt'
>;

export function toOwnDto(row: OwnDocumentRow): SpeakerDocumentDto {
  return {
    id: row.id,
    type: row.type,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt,
  };
}

export function toAdminDto(row: DocumentAdminRow): AdminDocumentDto {
  return {
    id: row.id,
    speaker: {
      id: row.speaker.id,
      displayName:
        row.speaker.publicName ??
        `${row.speaker.firstName} ${row.speaker.lastName}`,
    },
    type: row.type,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt,
  };
}

export function scalarSnapshot(row: SpeakerDocument): Record<string, unknown> {
  return {
    id: row.id,
    type: row.type,
    originalFilename: row.originalFilename,
    sizeBytes: row.sizeBytes,
  };
}
