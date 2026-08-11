import { EmailDeliveryStatus } from '@prisma/client';

export class EmailDeliveryItemDto {
  id!: number;
  template!: string;
  recipient!: string;
  subject!: string;
  status!: EmailDeliveryStatus;
  errorMessage!: string | null;
  attemptedAt!: Date;
  sentAt!: Date | null;
  relatedEntityType!: string | null;
  relatedEntityId!: number | null;
}

export class EmailDeliveryListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class EmailDeliveryListResponseDto {
  data!: EmailDeliveryItemDto[];
  meta!: EmailDeliveryListMetaDto;
}

// Réutilisé dans les vues détaillées de BookingRequest/RosterApplication
// (§E : "ajoute le statut du dernier envoi... pour que l'équipe voie
// «accusé de réception non envoyé»"). Historique COMPLET plutôt que le
// seul dernier envoi : le libellé du prompt cite un exemple singulier, mais
// une demande déclenche PLUSIEURS emails (notification interne, accusé de
// réception, assignation, rappels...) — si seul le tout dernier était
// exposé, un accusé de réception en échec pourrait être masqué par un
// email d'assignation réussi envoyé après lui. Le dernier élément du
// tableau (trié attemptedAt desc, donc l'élément [0]) EST "le dernier
// envoi" demandé — le reste est un bonus qui ne coûte rien de plus à
// calculer.
export class EmailDeliverySummaryDto {
  id!: number;
  template!: string;
  status!: EmailDeliveryStatus;
  errorMessage!: string | null;
  attemptedAt!: Date;
  sentAt!: Date | null;
}
