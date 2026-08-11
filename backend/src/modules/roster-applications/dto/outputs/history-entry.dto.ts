import { AdminRefDto } from './reference.dto';

// GET /admin/roster-applications/:id/history — même principe que
// BookingRequestHistoryEntryDto (Phase 3b) : projection directe
// d'activity_logs, filtrée sur entityType='RosterApplication' AND
// entityId=:id.
export class RosterApplicationHistoryEntryDto {
  id!: number;
  action!: string;
  actor!: AdminRefDto | null;
  oldValue!: unknown;
  newValue!: unknown;
  createdAt!: Date;
}
