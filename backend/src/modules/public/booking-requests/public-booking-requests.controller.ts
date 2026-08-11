import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { BookingRequestsService } from '../../booking-requests/booking-requests.service';
import { CreateBookingRequestDto } from '../../booking-requests/dto/create-booking-request.dto';
import { BookingRequestAckDto } from '../../booking-requests/dto/outputs/booking-request-ack.dto';

// Seule surface d'ÉCRITURE publique du projet avec /public/roster-applications
// (cf. CLAUDE.md §5) : contrôleur volontairement fin, sans logique métier —
// tout est délégué à BookingRequestsService (partagé avec l'admin), pour ne
// jamais dupliquer les règles de validation/SLA/référence entre les deux.
@ApiTags('Public — Booking requests')
@Controller('public/booking-requests')
@Public()
// Plus strict que la lecture (60/60s) mais plus permissif que /auth/login
// (5/60s, cible anti-bruteforce) : un utilisateur légitime peut corriger
// plusieurs fois un formulaire multi-champs avant de le valider, et ce n'est
// pas une cible d'attaque aussi sensible qu'un login — 20/60s est un
// compromis raisonnable, ajustable selon le trafic réel observé une fois le
// site en ligne.
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class PublicBookingRequestsController {
  constructor(
    private readonly bookingRequestsService: BookingRequestsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Soumission des 5 formulaires de réservation (conference, masterclass, webinar, advisory, one-to-one)',
  })
  @ApiCreatedResponse({ type: BookingRequestAckDto })
  create(@Body() dto: CreateBookingRequestDto): Promise<BookingRequestAckDto> {
    return this.bookingRequestsService.createFromPublic(dto);
  }
}
