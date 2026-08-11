import { ApiProperty } from '@nestjs/swagger';

// Accusé minimal renvoyé par POST /public/booking-requests — JAMAIS
// l'enregistrement complet (cf. CLAUDE.md §5 : aucune donnée interne ne doit
// transiter par une réponse publique).
export class BookingRequestAckDto {
  @ApiProperty({ example: 'ASB-2026-000123' })
  reference!: string;

  @ApiProperty({
    example:
      'Merci pour votre demande. Notre équipe vous répondra sous 2 jours ouvrés.',
  })
  message!: string;
}
