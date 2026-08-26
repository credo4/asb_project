import {
  ReportMetaDto,
  RankingItemDto,
  ComparedValueDto,
} from './report-common.dto';

// §14.1 — par speaker. Valeurs BRUTES de la période demandée (pas de
// comparaison période par période ici : c'est une TABLE, pas une tuile —
// voir Partie B, "chaque indicateur CLÉ s'affiche en tuile" / "les
// classements en TABLEAUX" — la comparaison période/période est réservée
// aux indicateurs agrégés au niveau du rapport, voir ComparedValueDto dans
// les autres rapports). `realizedRevenue` est OMIS (jamais `null`, la clé
// n'existe simplement pas dans le JSON) pour un acteur ADMIN — voir
// ReportsService#buildSpeakerMetrics (§A4 : "masqués, pas juste grisés").
export class SpeakerMetricDto {
  speakerId!: number;
  displayName!: string;
  slug!: string | null;
  // Vues de profil DÉDOUBLONNÉES (§A1, fenêtre de 30 min) sur la période.
  profileViews!: number;
  // Nombre de demandes l'ayant cité comme candidat (booking_request_speakers,
  // ajouté sur la période) — pas un total cumulé depuis toujours.
  requestsCount!: number;
  // Missions dont l'événement (eventDate) tombe sur la période.
  missionsCount!: number;
  // Dénominateur EXPLICITE du taux d'acceptation (§A1) : sollicitations
  // ayant reçu une réponse sur la période (SENT sans réponse exclues).
  availabilityResponsesTotal!: number;
  availabilityAcceptanceRate!: number | null;
  realizedRevenue?: number;
}

// Pagination réelle (voir QuerySpeakersReportDto) : la table par speaker,
// contrairement aux classements "top N" ci-dessous, peut compter plusieurs
// dizaines de lignes et alimente `useApiList` côté Partie B — même forme
// `{total, page, perPage}` que les autres listes de l'API (voir
// BookingRequestListMetaDto).
export class SpeakersReportListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class SpeakersReportDto {
  meta!: ReportMetaDto;
  // Tuiles (§ Partie B — "chaque indicateur CLÉ s'affiche en tuile") :
  // agrégats GLOBAUX de la période (tous les speakers ayant une activité,
  // pas seulement la page affichée de `speakers` ci-dessous) — ajoutés
  // après coup, au moment de construire la Partie B : la première version
  // de ce rapport (Partie A) n'exposait que la table et les classements,
  // aucun indicateur de rapport comparable à `conversionRate`/
  // `searchesCount` des deux autres rapports. `acceptanceRate` est le taux
  // GLOBAL (somme des acceptées / somme des répondues), pas la moyenne des
  // taux par speaker — une moyenne de taux fausserait le poids des
  // speakers à faible échantillon.
  totalProfileViews!: ComparedValueDto;
  totalRequests!: ComparedValueDto;
  totalMissions!: ComparedValueDto;
  acceptanceRate!: ComparedValueDto;
  speakers!: SpeakerMetricDto[];
  speakersMeta!: SpeakersReportListMetaDto;
  // Classements transverses (§14.1) — voir ReportsService pour
  // l'interprétation retenue : agrégés depuis les FORMATS/THÈMES des
  // speakers effectivement proposés sur des demandes pendant la période
  // (booking_request_speakers), pas depuis un champ texte libre. Top 10,
  // non paginés.
  topFormats!: RankingItemDto[];
  topThemes!: RankingItemDto[];
  // CRM-lié uniquement (organisation/contact rattaché) — une demande dont
  // l'intake n'a pas encore été rattaché à une fiche n'a pas de pays
  // structuré exploitable, jamais deviné depuis un champ texte libre.
  topClientCountries!: RankingItemDto[];
}
