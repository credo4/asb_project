import { MissionMessage, User } from '@prisma/client';
import { MissionMessageDto } from '../dto/outputs/mission-message.dto';

type Row = MissionMessage & { author: Pick<User, 'email'> | null };

export function toMessageDto(row: Row): MissionMessageDto {
  return {
    id: row.id,
    authorRole: row.authorRole,
    authorEmail: row.author?.email ?? null,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
