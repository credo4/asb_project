import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Body,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { RosterApplicationEvaluationsService } from './roster-application-evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

// Strictement interne (CLAUDE.md §5) : ADMIN/SUPER_ADMIN uniquement, jamais
// exposé au candidat ni à un rôle SPEAKER — voir la note en tête de
// RosterApplicationEvaluationDto.
@Controller('admin/roster-applications/:applicationId/evaluations')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class RosterApplicationEvaluationsController {
  constructor(
    private readonly evaluationsService: RosterApplicationEvaluationsService,
  ) {}

  @Get()
  findAll(@Param('applicationId', ParseIntPipe) applicationId: number) {
    return this.evaluationsService.listForApplication(applicationId);
  }

  // PUT (pas POST) : upsert explicite de L'ÉVALUATION DE L'ADMIN COURANT —
  // "me", pas d'id d'évaluation dans l'URL, jamais d'evaluatorId dans le body.
  @Put('me')
  upsertOwn(
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @Body() dto: CreateEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluationsService.upsertOwn(applicationId, dto, user);
  }
}
