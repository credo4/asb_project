import { RevisionStatus } from '@prisma/client';
import { SpeakerRevisionPayloadDto } from '../speaker-revision-payload.dto';

// Vue SPEAKER (self-service) : pas de référence à l'admin qui a revu, juste
// le résultat utile pour le speaker (voir SpeakerRevisionDetailDto pour la
// vue admin, plus complète).
export class SpeakerRevisionSummaryDto {
  id!: number;
  status!: RevisionStatus;
  payload!: SpeakerRevisionPayloadDto;
  submittedAt!: Date | null;
  reviewedAt!: Date | null;
  reviewerComment!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
