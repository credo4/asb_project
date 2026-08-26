import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { LoginEventsService } from './login-events.service';
import { QueryLoginEventsDto } from './dto/query-login-events.dto';

// §A3 — réservé SUPER_ADMIN (contrairement au reste de "Paramètres", où
// ADMIN a un accès lecture — le journal des connexions est plus sensible :
// il révèle qui tente de se connecter et depuis où, réservé au niveau
// d'accès le plus élevé).
@Controller('admin/login-events')
@Roles(Role.SUPER_ADMIN)
export class LoginEventsController {
  constructor(private readonly service: LoginEventsService) {}

  @Get()
  findAll(@Query() query: QueryLoginEventsDto) {
    return this.service.findAllForAdmin(query);
  }
}
