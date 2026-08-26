import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { Role } from '@prisma/client';

// §A1 — création UNIQUEMENT par invitation : jamais de mot de passe défini
// côté admin (voir CLAUDE.md, "un administrateur ne doit jamais connaître
// le mot de passe d'un autre"). Réservé ADMIN/SUPER_ADMIN comme rôle
// attribuable — ce endpoint n'est PAS la voie de création d'un compte
// SPEAKER (qui a son propre cycle : conversion de candidature, Phase 3c).
export class CreateUserInviteDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName!: string;

  @IsIn([Role.ADMIN, Role.SUPER_ADMIN])
  role!: typeof Role.ADMIN | typeof Role.SUPER_ADMIN;
}
