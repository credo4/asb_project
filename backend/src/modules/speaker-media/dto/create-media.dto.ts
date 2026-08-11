import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MediaType } from '@prisma/client';

// Toujours envoyé en multipart/form-data (même route que le fichier, voir
// controller) : PHOTO/PRESS_KIT attendent un fichier joint (champ "file"),
// VIDEO attend "url" et AUCUN fichier — validé dans le service, pas ici,
// puisque la présence du fichier dépend de multer, pas de class-validator.
export class CreateMediaDto {
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

  @ValidateIf((o: CreateMediaDto) => o.type === MediaType.VIDEO)
  @IsUrl({ require_protocol: true })
  url?: string;
}
