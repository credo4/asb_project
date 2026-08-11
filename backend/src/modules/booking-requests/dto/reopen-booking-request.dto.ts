import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BookingStatus } from '@prisma/client';

// PATCH /admin/booking-requests/:id/reopen — réservé SUPER_ADMIN (voir
// @Roles sur le contrôleur). Contourne délibérément la matrice de
// transitions standard (les 3 statuts terminaux y ont une liste de sortie
// vide) : c'est la SEULE façon de faire sortir une demande de
// CANCELLED/DECLINED/CLOSED. `targetStatus` doit lui-même être un statut
// NON terminal (vérifié dans le service) — rouvrir "vers CLOSED" n'aurait
// aucun sens.
export class ReopenBookingRequestDto {
  @IsEnum(BookingStatus)
  targetStatus!: BookingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
