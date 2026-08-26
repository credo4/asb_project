import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MissionDocumentType, Role } from '@prisma/client';

// Un seul DTO pour admin ET speaker — un document ne porte aucune donnée
// financière (voir Mission pour la frontière §5) : la restriction côté
// speaker se fait sur QUELS documents sont renvoyés (isSharedWithSpeaker OU
// déposés par lui-même — voir MissionDocumentsService#listForSpeaker),
// jamais sur les CHAMPS d'un document donné.
export class MissionDocumentDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: MissionDocumentType })
  type!: MissionDocumentType;

  @ApiProperty()
  isSharedWithSpeaker!: boolean;

  @ApiProperty()
  originalFilename!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({ enum: Role })
  uploadedByRole!: Role;

  @ApiPropertyOptional({ nullable: true })
  uploadedByEmail!: string | null;

  @ApiProperty()
  createdAt!: string;
}
