import { CuratedListStatus } from '@prisma/client';

export class CuratedListListItemDto {
  id!: number;
  title!: string;
  slug!: string;
  status!: CuratedListStatus;
  displayOrder!: number;
  memberCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class CuratedListListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class CuratedListListResponseDto {
  data!: CuratedListListItemDto[];
  meta!: CuratedListListMetaDto;
}
