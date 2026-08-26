import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

// Paramètres communs aux 3 rapports (§A2).
export class QueryReportsDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  // §A1 — robots exclus PAR DÉFAUT (analytics_events.isBot) ; ce paramètre
  // les réintègre explicitement.
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeBots?: boolean;

  // §A6 — variante CSV du même rapport, mêmes filtres. Un rapport contient
  // PLUSIEURS tableaux (classements) : `table` choisit lequel exporter,
  // avec un tableau par défaut sensé par rapport quand omis (voir
  // ReportsService — CSV_TABLES). Non documenté nommément par le prompt,
  // qui promet UN "?format=csv" par rapport (§A6) tout en demandant, côté
  // Partie B, "un bouton d'export CSV sur CHAQUE tableau" — ce paramètre
  // concilie les deux.
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';

  @IsOptional()
  table?: string;
}

// Rapport Speakers uniquement : sa table principale (par speaker) peut
// compter plusieurs dizaines de lignes, réutilisée par `useApiList` côté
// Partie B — véritable pagination serveur, contrairement aux classements
// "top N" des 3 rapports (formats/thèmes/pays/organisations/…), volontairement
// non paginés (voir ReportsService).
export class QuerySpeakersReportDto extends QueryReportsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number;
}
