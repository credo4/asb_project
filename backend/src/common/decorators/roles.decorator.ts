import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

// @Roles(Role.ADMIN, Role.SUPER_ADMIN) sur un handler/contrôleur : lu par
// RolesGuard pour restreindre l'accès aux rôles listés.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
