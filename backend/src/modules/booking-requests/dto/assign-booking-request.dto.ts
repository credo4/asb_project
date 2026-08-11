import { Type } from 'class-transformer';
import { IsInt, ValidateIf } from 'class-validator';

// PATCH /admin/booking-requests/:id/assign — endpoint dédié (§2.1), pas une
// simple mise à jour de champ : envoie un email à l'admin nouvellement
// assigné (voir BookingRequestsService#assign). `null` désassigne
// explicitement ; un admin peut se transmettre `assignedAdminId: <son
// propre id>` pour s'auto-assigner.
export class AssignBookingRequestDto {
  @ValidateIf((o: AssignBookingRequestDto) => o.assignedAdminId !== null)
  @Type(() => Number)
  @IsInt()
  assignedAdminId!: number | null;
}
