import { ArrayUnique, IsArray, IsInt } from 'class-validator';

// Liste ordonnée des id de TOUS les médias actifs du speaker — le nouvel
// index dans le tableau devient displayOrder. Doit être une permutation
// exacte de l'ensemble actuel (voir service) : ni plus, ni moins, sinon 400.
export class ReorderMediaDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  orderedIds!: number[];
}
