// Petites projections de taxonomies réutilisées dans les DTOs de sortie
// speakers (jamais l'entité Prisma brute).

export class CountryRefDto {
  id!: number;
  name!: string;
  iso2!: string;
}

export class PillarRefDto {
  id!: number;
  name!: string;
  slug!: string;
}

export class ThemeRefDto {
  id!: number;
  name!: string;
  slug!: string;
  pillarId!: number;
}

export class FormatRefDto {
  id!: number;
  name!: string;
  slug!: string;
}

export class LanguageRefDto {
  id!: number;
  name!: string;
  code!: string;
}
