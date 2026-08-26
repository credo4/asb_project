import { Role } from '@prisma/client';

// GET /auth/me — profil de l'utilisateur courant (déduit du JWT, jamais
// paramétrable). Allow-list volontairement étroite : jamais passwordHash,
// twoFactorSecret, ni aucun champ interne de `User` — voir
// mappers/auth.mapper.ts pour l'unique endroit qui projette l'entité brute
// vers ce DTO.
export class MeResponseDto {
  id!: number;
  email!: string;
  role!: Role;
  firstName!: string | null;
  lastName!: string | null;
  // Paramètres §28, "Mon compte" — bucket libre, voir UpdateMeDto.
  preferences!: Record<string, unknown> | null;
}
