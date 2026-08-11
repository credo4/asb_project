import { AdminRefDto } from './reference.dto';

// GET /admin/booking-requests/:id/history (§2.7) — projection directe
// d'activity_logs, filtrée sur entityType='BookingRequest' AND
// entityId=:id. Toutes les actions pertinentes (changements de statut,
// assignations, notes, pièces jointes, réouverture...) journalisent DÉJÀ
// avec ce couple (entityType, entityId) — un seul flux trié par createdAt
// suffit, pas besoin d'agréger plusieurs sources.
export class BookingRequestHistoryEntryDto {
  id!: number;
  action!: string;
  actor!: AdminRefDto | null;
  oldValue!: unknown;
  newValue!: unknown;
  createdAt!: Date;
}
