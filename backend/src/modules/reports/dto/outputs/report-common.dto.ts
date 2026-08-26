// Enveloppe commune aux 3 rapports (§A1/§A2).
export class ReportMetaDto {
  from!: Date;
  to!: Date;
  // §A1 — période précédente de MÊME DURÉE, "un chiffre seul ne veut rien
  // dire" : c'est la base de comparaison de chaque ComparedValueDto.
  previousFrom!: Date;
  previousTo!: Date;
  // §A1 — documenté ici plutôt que supposé (voir reports.constants.ts).
  timezone!: string;
  includeBots!: boolean;
  generatedAt!: Date;
}

export class ComparedValueDto {
  current!: number;
  previous!: number;
  deltaAbsolute!: number;
  deltaPercent!: number | null;
}

export class RankingItemDto {
  id!: number;
  label!: string;
  count!: number;
}
