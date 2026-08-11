import { MediaReviewStatus, MediaType } from '@prisma/client';

export class SpeakerRefDto {
  id!: number;
  displayName!: string;
}

export class AdminRefDto {
  id!: number;
  email!: string;
}

// Vue admin : inclut la référence du speaker (liste transversale, pas
// scopée à un seul profil) et le réviseur le cas échéant.
export class AdminMediaItemDto {
  id!: number;
  speaker!: SpeakerRefDto;
  type!: MediaType;
  url!: string;
  thumbnailUrl!: string | null;
  title!: string | null;
  caption!: string | null;
  displayOrder!: number;
  status!: MediaReviewStatus;
  reviewedAt!: Date | null;
  reviewedBy!: AdminRefDto | null;
  rejectionReason!: string | null;
  createdAt!: Date;
}

export class AdminMediaListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class AdminMediaListResponseDto {
  data!: AdminMediaItemDto[];
  meta!: AdminMediaListMetaDto;
}
