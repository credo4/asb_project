import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { SpeakerAvailabilityService } from './speaker-availability.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { UpsertTravelPreferencesDto } from './dto/upsert-travel-preferences.dto';

// Chemin à 3 segments (`:id/availability/...`) : aucune collision possible
// avec le contrôleur de recherche (`admin/speakers/available`, 2 segments)
// ni avec SpeakersController (`admin/speakers/:id`, 2 segments) — voir le
// commentaire sur la contrainte numérique dans speakers.controller.ts pour
// le seul cas qui, lui, nécessitait une contrainte explicite.
@Controller('admin/speakers/:id/availability')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminSpeakerAvailabilityController {
  constructor(private readonly service: SpeakerAvailabilityService) {}

  @Get()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getForAdmin(id);
  }

  @Post('periods')
  createPeriod(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createPeriodForAdmin(id, dto, user);
  }

  @Patch('periods/:periodId')
  updatePeriod(
    @Param('id', ParseIntPipe) id: number,
    @Param('periodId', ParseIntPipe) periodId: number,
    @Body() dto: UpdatePeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updatePeriodForAdmin(id, periodId, dto, user);
  }

  @Delete('periods/:periodId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePeriod(
    @Param('id', ParseIntPipe) id: number,
    @Param('periodId', ParseIntPipe) periodId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removePeriodForAdmin(id, periodId, user);
  }

  @Put('preferences')
  upsertPreferences(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertTravelPreferencesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upsertPreferencesForAdmin(id, dto, user);
  }
}
