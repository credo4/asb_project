import {
  Body,
  Controller,
  Get,
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
import { RosterApplicationsService } from './roster-applications.service';
import { QueryRosterApplicationsDto } from './dto/query-roster-applications.dto';
import { UpdateRosterApplicationStatusDto } from './dto/update-roster-application-status.dto';
import { AssignRosterApplicationDto } from './dto/assign-roster-application.dto';
import { ReopenRosterApplicationDto } from './dto/reopen-roster-application.dto';
import { RequestInfoDto } from './dto/request-info.dto';
import { RejectRosterApplicationDto } from './dto/reject-roster-application.dto';
import { AttachExistingUserDto } from './dto/attach-existing-user.dto';

@Controller('admin/roster-applications')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class RosterApplicationsController {
  constructor(
    private readonly rosterApplicationsService: RosterApplicationsService,
  ) {}

  @Get()
  findAll(@Query() query: QueryRosterApplicationsDto) {
    return this.rosterApplicationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rosterApplicationsService.findOne(id);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.rosterApplicationsService.getHistory(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRosterApplicationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rosterApplicationsService.updateStatus(id, dto, user);
  }

  // Réservé SUPER_ADMIN — override le @Roles() de classe (§1 : REJECTED et
  // ARCHIVED sont terminaux, seule cette action dédiée en sort).
  @Patch(':id/reopen')
  @Roles(Role.SUPER_ADMIN)
  reopen(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenRosterApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rosterApplicationsService.reopen(id, dto, user);
  }

  @Patch(':id/assign')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRosterApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rosterApplicationsService.assign(id, dto, user);
  }

  // §3 — passage en INFO_REQUESTED : message + email templaté + journalisation.
  @Post(':id/request-info')
  requestInfo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RequestInfoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rosterApplicationsService.requestInfo(id, dto, user);
  }

  // §3 — passage en REJECTED : motif obligatoire, email optionnel (case
  // explicite dans le body, jamais automatique).
  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectRosterApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rosterApplicationsService.reject(id, dto, user);
  }

  // §4 — LA conversion. Autorisé uniquement depuis APPROVED, idempotent
  // (409 si déjà convertie) — voir RosterApplicationsService#convert.
  @Post(':id/convert')
  convert(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rosterApplicationsService.convert(id, user);
  }

  // §4.3 — email déjà utilisé par un compte existant : rattachement explicite.
  @Post(':id/attach-existing-user')
  attachExistingUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AttachExistingUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rosterApplicationsService.attachExistingUser(id, dto, user);
  }

  // §4.4 — invalide le token précédent, en émet un nouveau.
  @Post(':id/resend-invitation')
  resendInvitation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rosterApplicationsService.resendInvitation(id, user);
  }
}
