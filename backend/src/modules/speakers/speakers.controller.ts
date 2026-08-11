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
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { SpeakersService } from './speakers.service';
import { CreateSpeakerDto } from './dto/create-speaker.dto';
import { UpdateSpeakerDto } from './dto/update-speaker.dto';
import { UpdateSpeakerStatusDto } from './dto/update-speaker-status.dto';
import { QuerySpeakersDto } from './dto/query-speakers.dto';
import { SpeakerAvailabilityService } from '../speaker-availability/speaker-availability.service';
import { QueryAvailableSpeakersDto } from '../speaker-availability/dto/query-available-speakers.dto';

// `@Roles` au niveau du contrôleur s'applique à toutes ses routes (le guard
// global JwtAuthGuard exige déjà un token — aucune route ici n'est publique).
@Controller('admin/speakers')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class SpeakersController {
  constructor(
    private readonly speakersService: SpeakersService,
    private readonly availabilityService: SpeakerAvailabilityService,
  ) {}

  @Get()
  findAll(@Query() query: QuerySpeakersDto) {
    return this.speakersService.findAll(query);
  }

  // ⚠️ Route littérale, DOIT rester déclarée AVANT `@Get(':id')` ci-dessous.
  // NestJS enregistre les routes d'un même contrôleur dans l'ordre de
  // déclaration des méthodes (garanti, indépendant de tout ordre d'import de
  // module) — Express résout ensuite la première route qui matche dans son
  // ordre d'enregistrement, pas par spécificité de motif : si `:id` était
  // déclaré en premier, "available" serait avalé par `:id` (id = "available",
  // 400 de ParseIntPipe). C'est pour ça que cette route vit ICI, dans
  // SpeakersController, plutôt que dans son propre contrôleur du module
  // speaker-availability — ça garantit l'ordre par construction plutôt que
  // par un ordre d'import fragile. La logique elle-même reste entièrement
  // dans SpeakerAvailabilityService (voir Phase 2, étape 2d) ; ce contrôleur
  // ne fait que router.
  @Get('available')
  findAvailable(@Query() query: QueryAvailableSpeakersDto) {
    return this.availabilityService.searchAvailableSpeakers(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.speakersService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateSpeakerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.speakersService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSpeakerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.speakersService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.speakersService.remove(id, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSpeakerStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.speakersService.updateStatus(id, dto, user);
  }
}
