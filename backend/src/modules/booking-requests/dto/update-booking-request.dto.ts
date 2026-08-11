import { IsEnum, IsOptional } from 'class-validator';
import { BookingPriority } from '@prisma/client';

// Phase 3b : `status` et `assignedAdminId` ont chacun leur endpoint dédié
// (PATCH .../status, PATCH .../assign — journalisation et effets de bord
// distincts, voir booking-requests.controller.ts). `internalNotes` a été
// remplacé par la table booking_request_notes (ajout seul, §2.3). Ne reste
// ici que la priorité, seul champ qui n'a pas besoin de traitement dédié.
export class UpdateBookingRequestDto {
  @IsOptional()
  @IsEnum(BookingPriority)
  priority?: BookingPriority;
}
