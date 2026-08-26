import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

// GET /admin/availability-requests?bookingRequestId=X -- lecture seule,
// AJOUTÉE pour le bloc "Speakers proposés" du back-office (extension
// matching/disponibilité, voir CLAUDE.md) : sans elle, aucun moyen de
// savoir qu'une sollicitation a déjà été envoyée à un speaker donné, ni de
// lire sa réponse une fois arrivée. `bookingRequestId` obligatoire (pas de
// liste globale non filtrée) -- un seul usage prévu pour l'instant : la
// vue détail d'une demande.
export class ListAvailabilityRequestsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  bookingRequestId!: number;
}
