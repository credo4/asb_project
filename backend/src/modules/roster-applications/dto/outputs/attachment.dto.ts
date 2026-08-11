import { AdminRefDto } from './reference.dto';

// Volontairement SANS storageKey — même principe que
// BookingRequestAttachmentDto (Phase 3b) : jamais exposé, seul un lien signé
// donne accès au contenu.
export class RosterApplicationAttachmentDto {
  id!: number;
  originalFilename!: string;
  mimeType!: string;
  sizeBytes!: number;
  uploadedBy!: AdminRefDto | null;
  uploadedAt!: Date;
}
