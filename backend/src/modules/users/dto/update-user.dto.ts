import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';

// PATCH /admin/users/:id — édition par un SUPER_ADMIN. Le changement de
// rôle passe par CE DTO (pas un endpoint séparé) mais reste soumis aux
// garde-fous du service (jamais son propre rôle, jamais le dernier
// SUPER_ADMIN actif rétrogradé) — voir UsersService#update.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsIn([Role.ADMIN, Role.SUPER_ADMIN])
  role?: typeof Role.ADMIN | typeof Role.SUPER_ADMIN;
}
