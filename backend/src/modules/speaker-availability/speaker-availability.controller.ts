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

// Aucune route ici n'accepte un id de SPEAKER fourni par l'appelant (voir
// resolveOwnSpeakerId, dérivé exclusivement de actor.id) — même principe que
// speaker-media/speaker-documents (§2). Les routes /periods/:id acceptent un
// id de PÉRIODE, toujours scopé par speakerId côté service : un id d'une
// période appartenant à un autre speaker produit 404 (jamais 403).
@Controller('speaker/me/availability')
@Roles(Role.SPEAKER)
export class SpeakerAvailabilityController {
  constructor(private readonly service: SpeakerAvailabilityService) {}

  @Get()
  findOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getOwn(user);
  }

  @Post('periods')
  createPeriod(
    @Body() dto: CreatePeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createOwnPeriod(user, dto);
  }

  @Patch('periods/:id')
  updatePeriod(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateOwnPeriod(user, id, dto);
  }

  @Delete('periods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePeriod(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeOwnPeriod(user, id);
  }

  @Put('preferences')
  upsertPreferences(
    @Body() dto: UpsertTravelPreferencesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upsertOwnPreferences(user, dto);
  }
}
