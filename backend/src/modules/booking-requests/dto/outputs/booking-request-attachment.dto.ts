import { AdminRefDto } from './reference.dto';

// Volontairement SANS storageKey (§2.4, même principe que speaker_documents)
// — jamais exposé, seul un lien signé donne accès au contenu.
export class BookingRequestAttachmentDto {
  id!: number;
  originalFilename!: string;
  mimeType!: string;
  sizeBytes!: number;
  uploadedBy!: AdminRefDto | null;
  uploadedAt!: Date;
}
