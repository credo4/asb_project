import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

// POST /admin/users/:id/deactivate — désactiver un admin qui a des demandes/
// candidatures/organisations assignées exige un choix explicite (§A1) :
// soit les libérer (`release: true`), soit les réassigner
// (`reassignToUserId`). Ni les deux, ni aucun des deux quand des lignes
// assignées existent — validé ici pour l'un, dans le service pour l'autre
// (le service seul sait si des lignes assignées existent réellement).
export class DeactivateUserDto {
  @IsOptional()
  @IsBoolean()
  release?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reassignToUserId?: number;
}
