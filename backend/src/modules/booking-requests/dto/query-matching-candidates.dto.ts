import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

// Phase 3d, §1 — recherche ASSISTÉE, pas un algorithme : ces critères sont
// pré-remplis depuis la demande par le SERVICE (voir MatchingService),
// chacun restant modifiable ici en paramètre de requête.
//
// ⚠️ Pré-remplissage BEST-EFFORT, pas total : `booking_requests` stocke
// `eventLocation`/`eventFormat`/`language`/`audienceSize`/`estimatedBudget`
// en TEXTE LIBRE (formulaires Phase 1), sans colonnes structurées
// pays/langue/format/budget. Deviner un ISO2 ou un code langue depuis du
// texte libre serait exactement le genre d'heuristique fragile que ce
// projet refuse ailleurs (cf. CLAUDE.md — mapping pilier en conversion de
// candidature : jamais deviné, seulement sur correspondance EXACTE). Donc :
// seul `eventDate` (colonne DATETIME structurée) est réellement pré-rempli
// automatiquement ; pilier/thème/format/langue/pays/virtuel n'ont RIEN à
// pré-remplir depuis la demande et restent à la discrétion de l'admin via
// ces paramètres — les champs texte libre d'origine sont renvoyés tels
// quels dans la réponse (voir MatchingCandidateDto.context) pour que
// l'admin les lise et choisisse lui-même.
export class QueryMatchingCandidatesDto {
  @ApiPropertyOptional({ description: 'Slug du pilier' })
  @IsOptional()
  @IsString()
  pillar?: string;

  @ApiPropertyOptional({ description: 'Slug du thème' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Slug du format' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ description: 'Code langue (ex: "fr")' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Code ISO2 du pays de l’événement' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Défaut : booking_requests.event_date. Format YYYY-MM-DD.',
  })
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @ApiPropertyOptional({
    description:
      'Défaut : identique à eventDate (événement mono-jour). Format YYYY-MM-DD.',
  })
  @IsOptional()
  @IsDateString()
  eventEndDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      "Inclure les speakers non PUBLISHED (l'équipe peut vouloir proposer un profil en cours de validation).",
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeUnpublished?: boolean;
}
