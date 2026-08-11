import { IsInt } from 'class-validator';

// N'importe quel speaker existant peut être ajouté (y compris DRAFT/non
// visible) — c'est le FILTRE DE LECTURE publique qui garantit qu'un membre
// non publié n'apparaît jamais côté public (§B4), pas une restriction à
// l'ajout côté admin : un admin doit pouvoir préparer une liste avant que
// tous ses membres ne soient eux-mêmes publiés.
export class AddCuratedListMemberDto {
  @IsInt()
  speakerId!: number;
}
