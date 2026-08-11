import { RevisionStatus } from '@prisma/client';
import { SpeakerRevisionPayloadDto } from '../speaker-revision-payload.dto';
import { AdminRefDto, SpeakerRefDto } from './reference.dto';
import { SpeakerRevisionDiffDto } from './speaker-revision-diff.dto';

// Vue ADMIN complète (GET /admin/speaker-revisions/:id) — inclut la
// comparaison avant/après (cf. §6), calculée à la volée par
// SpeakerRevisionDiffService, jamais stockée (toujours fraîche vis-à-vis de
// l'état live actuel du speaker).
export class SpeakerRevisionDetailDto {
  id!: number;
  speaker!: SpeakerRefDto;
  status!: RevisionStatus;
  payload!: SpeakerRevisionPayloadDto;
  diff!: SpeakerRevisionDiffDto;
  submittedAt!: Date | null;
  reviewedAt!: Date | null;
  reviewedBy!: AdminRefDto | null;
  reviewerComment!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
