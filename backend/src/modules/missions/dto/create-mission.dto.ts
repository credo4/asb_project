import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

// §1 — corps volontairement minimal : la mission est pré-remplie depuis la
// demande (bookingRequestId vient du chemin) et le speaker (booking_request_speakers) —
// seul speakerId identifie QUI, le reste se complète ensuite via
// PATCH /admin/missions/:id (§8, "CRUD des champs").
export class CreateMissionDto {
  @ApiProperty()
  @IsInt()
  speakerId!: number;
}
