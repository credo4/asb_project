import { SpeakerDocumentType } from '@prisma/client';

// AUCUN champ storageKey ici, volontairement (§4 : "le storageKey stocké en
// base ne doit jamais être exposé tel quel dans une réponse API"). Pour
// accéder au contenu, voir GET .../download-link.
export class SpeakerDocumentDto {
  id!: number;
  type!: SpeakerDocumentType;
  originalFilename!: string;
  mimeType!: string;
  sizeBytes!: number;
  uploadedAt!: Date;
}
