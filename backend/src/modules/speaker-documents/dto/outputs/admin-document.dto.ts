import { SpeakerDocumentType } from '@prisma/client';

// Même principe que SpeakerDocumentDto : pas de storageKey. `speaker` en
// plus, pour une liste transversale admin.
export class AdminDocumentDto {
  id!: number;
  speaker!: { id: number; displayName: string };
  type!: SpeakerDocumentType;
  originalFilename!: string;
  mimeType!: string;
  sizeBytes!: number;
  uploadedAt!: Date;
}
