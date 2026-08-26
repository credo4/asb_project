import { MissionChecklistItem, User } from '@prisma/client';
import { MissionChecklistItemDto } from '../dto/outputs/mission-checklist-item.dto';

type Row = MissionChecklistItem & { doneBy: Pick<User, 'email'> | null };

export function toChecklistDto(row: Row): MissionChecklistItemDto {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    displayOrder: row.displayOrder,
    isDone: row.isDone,
    doneAt: row.doneAt?.toISOString() ?? null,
    doneByEmail: row.doneBy?.email ?? null,
    notes: row.notes,
  };
}
