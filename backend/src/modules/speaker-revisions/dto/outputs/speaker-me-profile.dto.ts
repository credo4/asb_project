import { SpeakerDetailDto } from '../../../speakers/dto/speaker-detail.dto';
import { SpeakerRevisionSummaryDto } from './speaker-revision-summary.dto';

// Identique à SpeakerDetailDto (module admin) MOINS `pricing` : la
// tarification est une donnée d'agence, jamais montrée au speaker lui-même
// (ni au public — cf. CLAUDE.md §5 — ni à l'intéressé).
export type SpeakerOwnProfileDto = Omit<SpeakerDetailDto, 'pricing'>;

export class SpeakerMeProfileDto {
  profile!: SpeakerOwnProfileDto;
  // Révision active (DRAFT/SUBMITTED/CHANGES_REQUESTED) s'il y en a une,
  // sinon null — état parfaitement normal, pas une erreur 404.
  currentRevision!: SpeakerRevisionSummaryDto | null;
}
