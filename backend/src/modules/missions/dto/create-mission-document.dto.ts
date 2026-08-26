import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { MissionDocumentType } from '@prisma/client';

// Ce DTO est reçu en `multipart/form-data` (upload de fichier) : un champ
// booléen y arrive TOUJOURS en string ("true"/"false"), jamais un vrai
// booléen JS. `@Type(() => Boolean)` de class-transformer convertirait
// n'importe quelle chaîne non vide (y compris "false") en `true` — piège
// classique déjà rencontré ailleurs dans ce projet (voir
// query-available-speakers.dto.ts/query-speakers.dto.ts) : d'où ce
// `toBoolean` local plutôt que `@Type`.
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class CreateMissionDocumentDto {
  @ApiProperty({ enum: MissionDocumentType })
  @IsEnum(MissionDocumentType)
  type!: MissionDocumentType;

  // Ignoré côté speaker (toujours forcé à `false` en entrée — voir
  // MissionDocumentsService#uploadForSpeaker : un speaker ne PARTAGE rien
  // vers lui-même, ce champ n'a de sens que côté admin, §7).
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isSharedWithSpeaker?: boolean;
}
