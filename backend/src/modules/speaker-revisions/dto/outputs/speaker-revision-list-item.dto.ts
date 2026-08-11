import { RevisionStatus } from '@prisma/client';
import { SpeakerRefDto } from './reference.dto';

export class SpeakerRevisionListItemDto {
  id!: number;
  speaker!: SpeakerRefDto;
  status!: RevisionStatus;
  submittedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class SpeakerRevisionListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class SpeakerRevisionListResponseDto {
  data!: SpeakerRevisionListItemDto[];
  meta!: SpeakerRevisionListMetaDto;
}
