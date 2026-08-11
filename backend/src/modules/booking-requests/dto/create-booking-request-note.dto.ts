import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// POST /admin/booking-requests/:id/notes — AJOUT SEUL (§2.3) : pas de PATCH,
// une note ne se modifie jamais après coup.
export class CreateBookingRequestNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;
}
