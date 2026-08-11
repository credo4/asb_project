import { Type } from 'class-transformer';
import { IsInt, ValidateIf } from 'class-validator';

// PATCH /admin/roster-applications/:id/assign — même pattern que
// AssignBookingRequestDto (Phase 3b). `null` désassigne explicitement.
export class AssignRosterApplicationDto {
  @ValidateIf((o: AssignRosterApplicationDto) => o.assignedAdminId !== null)
  @Type(() => Number)
  @IsInt()
  assignedAdminId!: number | null;
}
