import { IsOptional, IsString, MaxLength } from 'class-validator';

// Pas de ré-upload de fichier ni de changement de `type` ici : pour ça, on
// supprime et on recrée (cohérent avec "le nom de fichier est toujours
// généré côté serveur", pas de remplacement en place). Modifier le titre/la
// légende repasse l'item en PENDING_REVIEW (voir service) : c'est du contenu
// public que l'admin n'a pas encore vu dans cette version.
export class UpdateMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;
}
