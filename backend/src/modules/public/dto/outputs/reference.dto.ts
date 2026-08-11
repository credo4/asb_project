import { ApiProperty } from '@nestjs/swagger';

// Dupliqué volontairement depuis les DTOs "outputs" du module admin
// (src/modules/speakers/dto/outputs/reference.dto.ts) plutôt que réutilisé.
// Le module public ne doit JAMAIS dépendre du module admin — même pour un
// type aussi anodin qu'une référence de pays — afin qu'une modification
// future du module admin ne puisse jamais, par ricochet, changer ce qui
// est exposé publiquement (voir CLAUDE.md §5).

export class PublicCountryRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  iso2!: string;
}

export class PublicPillarRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class PublicThemeRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  pillarId!: number;
}

export class PublicFormatRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class PublicLanguageRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;
}
