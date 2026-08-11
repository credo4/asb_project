import { SpeakerStatus } from '@prisma/client';

// Projection ADMIN d'un membre — inclut le statut/la visibilité du speaker
// pour que l'équipe comprenne immédiatement pourquoi un membre n'apparaît
// pas (encore) côté public (§B4 : le filtrage est fait à la lecture
// publique, pas à l'ajout). JAMAIS exposée telle quelle côté public — voir
// le mapper public qui réutilise PublicSpeakerListItemDto à la place.
export class CuratedListMemberDto {
  speakerId!: number;
  displayName!: string;
  slug!: string | null;
  status!: SpeakerStatus;
  isVisible!: boolean;
  displayOrder!: number;
}
