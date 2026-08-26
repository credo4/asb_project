// GET /admin/missions/:id/history — projection directe d'activity_logs,
// filtrée sur entityType='Mission' AND entityId=:id. Toutes les actions
// relatives à une mission (création, statut, champs, checklist, documents,
// messages, acceptation) journalisent DÉJÀ sous ce même couple — un seul
// flux trié par createdAt suffit, même principe que
// BookingRequestHistoryEntryDto (booking-requests, §2.7).
export class MissionAdminRefDto {
  id!: number;
  email!: string;
  firstName!: string | null;
  lastName!: string | null;
}

export class MissionHistoryEntryDto {
  id!: number;
  action!: string;
  actor!: MissionAdminRefDto | null;
  oldValue!: unknown;
  newValue!: unknown;
  createdAt!: Date;
}
