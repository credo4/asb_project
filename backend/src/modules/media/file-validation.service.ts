import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { fromBuffer as fileTypeFromBuffer } from 'file-type';

const PDF_MIME_TYPE = 'application/pdf';

// Formats "bureautiques courants" acceptés pour les pièces jointes de
// demandes (Phase 3b, §2.4) : PDF, images usuelles, ET les formats OOXML
// modernes (docx/xlsx/pptx). Les anciens formats binaires .doc/.xls/.ppt
// sont volontairement EXCLUS : leur conteneur "Compound File Binary" (OLE2)
// est identique pour les trois, la détection par contenu réel ne peut donc
// PAS distinguer un .doc d'un .xls falsifié — accepter ce conteneur
// reviendrait à faire confiance à l'extension déclarée pour ces trois types,
// exactement ce que ce projet refuse de faire ailleurs (cf. CLAUDE.md §8).
// Mieux vaut rejeter un vieux fichier légitime que d'ouvrir cette brèche.
export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
] as const;

// Validation de documents non-image (sharp ne s'applique qu'aux images —
// voir ImageProcessingService). Même principe : ne jamais faire confiance à
// l'extension du fichier ni au Content-Type déclaré par le client.
@Injectable()
export class FileValidationService {
  // "Magic bytes" (ou "file signature") : les premiers octets d'un fichier
  // encodent son VRAI format, indépendamment de son nom. Un PDF commence
  // toujours par `%PDF-` (0x25 0x50 0x44 0x46 0x2D) ; un .exe renommé en
  // .pdf commence par `MZ` — la lecture du Content-Type ou de l'extension ne
  // verrait jamais la différence (les deux sont juste des chaînes fournies
  // par le client, triviales à falsifier), alors que lire le contenu réel
  // du fichier ne peut pas mentir sur ce qu'il est.
  async assertIsPdf(buffer: Buffer): Promise<void> {
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || detected.mime !== PDF_MIME_TYPE) {
      throw new UnsupportedMediaTypeException(
        "Le fichier envoyé n'est pas un PDF valide (vérification par contenu, pas par extension).",
      );
    }
  }

  // Générique, réutilisable par n'importe quel module ayant besoin d'une
  // allow-list de types différente de "PDF uniquement" (voir
  // booking-request-attachments.service.ts). Retourne le mime détecté (par
  // contenu réel, jamais l'extension/Content-Type déclarés).
  async detectAllowedType(
    buffer: Buffer,
    allowedMimeTypes: readonly string[],
  ): Promise<string> {
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !allowedMimeTypes.includes(detected.mime)) {
      throw new UnsupportedMediaTypeException(
        `Type de fichier non autorisé (détecté : ${detected?.mime ?? 'inconnu'}).`,
      );
    }
    return detected.mime;
  }
}
