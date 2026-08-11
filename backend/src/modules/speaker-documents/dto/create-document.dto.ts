import { IsEnum } from 'class-validator';
import { SpeakerDocumentType } from '@prisma/client';

// Multipart/form-data : `type` en champ texte + fichier joint (champ "file",
// validé par le service via magic bytes — voir FileValidationService).
export class CreateDocumentDto {
  @IsEnum(SpeakerDocumentType)
  type!: SpeakerDocumentType;
}
