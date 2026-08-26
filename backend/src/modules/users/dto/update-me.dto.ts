import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// PATCH /auth/me — auto-édition de son PROPRE compte (voir AuthController).
// Volontairement PAS de champ `role`/`status` ici : un utilisateur ne peut
// jamais changer ces deux-là sur lui-même, quel que soit l'endpoint (même
// garde-fou que UsersService#update, qui refuse déjà le changement de rôle
// sur soi-même — ce DTO le rend simplement impossible à exprimer).
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Bucket libre (voir schema.prisma#User.preferences) — remplacé tel
  // quel, jamais fusionné en profondeur : plus simple et prévisible pour
  // un client qui relit toujours l'état complet avant d'écrire.
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}
