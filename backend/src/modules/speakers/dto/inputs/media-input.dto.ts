import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MediaType } from '@prisma/client';

// Référence un média déjà uploadé (voir étape 1a, POST /admin/media/upload) :
// ce DTO ne reçoit jamais de fichier, seulement l'URL/clé qu'on nous a
// rendue. Écrit directement en status = APPROVED par le service (un admin ne
// s'auto-valide pas via la file de revue, mais son écriture directe vaut
// approbation immédiate — cf. consolidation Phase 2, Partie A) — pas de
// champ `status` ici, ce n'est pas à l'appelant de le choisir.
export class MediaInputDto {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  // Requis (contrairement à la Phase 1, qui avait deux champs distincts
  // `url`/`filePath` dont l'un pouvait rester vide) : la table unique n'a
  // plus qu'un seul champ url, toujours renseigné.
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
