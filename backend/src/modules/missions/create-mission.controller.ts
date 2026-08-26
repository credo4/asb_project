import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dto/create-mission.dto';

// Nichée sous /admin/booking-requests/:requestId/missions (§1) plutôt que
// sous /admin/missions — la création est une action de la demande cliente
// ("créer une mission POUR cette demande"), cohérent avec le reste de la
// section 8 du prompt qui présente §1 avant §8 (liste/détail génériques).
@Controller('admin/booking-requests/:requestId/missions')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class CreateMissionController {
  constructor(private readonly service: MissionsService) {}

  @Post()
  create(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: CreateMissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(requestId, dto, user);
  }
}
