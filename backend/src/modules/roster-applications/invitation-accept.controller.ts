import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RosterApplicationsService } from './roster-applications.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

// Monté sous /auth (même préfixe que login/verify-email/reset-password, cf.
// modules/auth/auth.controller.ts) bien que ce contrôleur vive dans
// roster-applications/ — InvitationToken est un concept propre à cette
// étape (conversion de candidature), mais l'action elle-même ("définir un
// mot de passe et se connecter via un lien reçu par email") est de la même
// famille que le reste de /auth côté API publique. Nest ne s'en soucie pas :
// plusieurs contrôleurs, dans des modules différents, peuvent partager un
// même préfixe de route.
@Controller('auth')
export class InvitationAcceptController {
  constructor(
    private readonly rosterApplicationsService: RosterApplicationsService,
  ) {}

  // Pas de @Throttle dédié (contrairement à /auth/login) : le secret ici
  // est le TOKEN (256 bits d'entropie), pas un mot de passe associé à un
  // email connu — un rate-limit par IP n'apporte rien contre le
  // brute-force d'un token de cette taille. Le throttle global par défaut
  // (ThrottlerModule.forRoot, 100 req/min — voir app.module.ts) protège
  // déjà contre le spam générique.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('accept-invitation')
  acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.rosterApplicationsService.acceptInvitation(dto);
  }
}
