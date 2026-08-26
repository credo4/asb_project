import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { MissionChecklistService } from './mission-checklist.service';
import { ToggleChecklistItemDto } from './dto/toggle-checklist-item.dto';
import { AddChecklistItemDto } from './dto/add-checklist-item.dto';

// §4 — ADMIN uniquement (aucun accès speaker à la checklist demandé).
@Controller('admin/missions/:missionId/checklist')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class MissionChecklistController {
  constructor(private readonly service: MissionChecklistService) {}

  @Patch(':itemId')
  toggle(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: ToggleChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.toggle(missionId, itemId, dto, user);
  }

  @Post()
  add(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Body() dto: AddChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.add(missionId, dto, user);
  }
}
