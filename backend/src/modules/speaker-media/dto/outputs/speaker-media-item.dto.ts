import { MediaReviewStatus, MediaType } from '@prisma/client';

// Vue "propriétaire" (le speaker voit le statut de revue de SES médias —
// jamais exposée telle quelle côté public, voir modules/public).
export class SpeakerMediaItemDto {
  id!: number;
  type!: MediaType;
  url!: string;
  thumbnailUrl!: string | null;
  title!: string | null;
  caption!: string | null;
  displayOrder!: number;
  status!: MediaReviewStatus;
  rejectionReason!: string | null;
  createdAt!: Date;
}
