import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCuratedListDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  // Optionnel : auto-généré depuis `title` si absent (voir
  // curated-list-slug.util.ts), même principe que les speakers.
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'Le slug ne doit contenir que des minuscules, chiffres et tirets (ex: "top-fintech-voices").',
  })
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
