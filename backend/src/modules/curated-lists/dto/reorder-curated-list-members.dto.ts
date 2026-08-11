import { ArrayUnique, IsArray, IsInt } from 'class-validator';

// Même stratégie que ReorderMediaDto (speaker-media) : liste ordonnée de
// TOUS les speakerId actuellement membres de la liste — le nouvel index
// devient displayOrder. Doit être une permutation exacte de l'ensemble
// actuel (voir service), sinon 400.
export class ReorderCuratedListMembersDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  orderedSpeakerIds!: number[];
}
