import { User } from '@prisma/client';
import { MeResponseDto } from '../dto/outputs/me.dto';

export function toMeResponseDto(user: User): MeResponseDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    preferences: (user.preferences as Record<string, unknown> | null) ?? null,
  };
}
