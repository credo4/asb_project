import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BookingStatus } from '@prisma/client';

// PATCH /admin/booking-requests/:id/status — validé contre la matrice
// centralisée (booking-request-status-transitions.util.ts). N'autorise
// JAMAIS de sortir d'un statut terminal (CANCELLED/DECLINED/CLOSED), y
// compris pour un SUPER_ADMIN : voir ReopenBookingRequestDto pour ça.
export class UpdateBookingRequestStatusDto {
  @IsEnum(BookingStatus)
  status!: BookingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
