import { CuratedListSelectionMode, CuratedListStatus } from '@prisma/client';
import { CuratedListMemberDto } from './curated-list-member.dto';

export class CuratedListDetailDto {
  id!: number;
  title!: string;
  slug!: string;
  description!: string | null;
  imageUrl!: string | null;
  displayOrder!: number;
  status!: CuratedListStatus;
  publishedAt!: Date | null;
  selectionMode!: CuratedListSelectionMode;
  members!: CuratedListMemberDto[];
  createdAt!: Date;
  updatedAt!: Date;
}
