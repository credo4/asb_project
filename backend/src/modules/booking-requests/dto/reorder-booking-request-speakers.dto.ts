import { ArrayUnique, IsArray, IsInt } from 'class-validator';

// Même stratégie que ReorderCuratedListMembersDto : liste ordonnée de TOUS
// les speakerId actuellement dans la sélection (non supprimée) — le nouvel
// index devient displayOrder. Doit être une permutation exacte de
// l'ensemble actuel (voir service), sinon 400.
export class ReorderBookingRequestSpeakersDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  orderedSpeakerIds!: number[];
}
