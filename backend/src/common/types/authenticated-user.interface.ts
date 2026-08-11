import { Role } from '@prisma/client';

// Forme de `request.user`, injectée par la stratégie Passport JWT après
// validation du token. Partagée entre guards, décorateurs et modules métier.
export interface AuthenticatedUser {
  id: number;
  email: string;
  role: Role;
}
