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
import { BookingRequestsService } from './booking-requests.service';
import { CreateManualBookingRequestDto } from './dto/create-manual-booking-request.dto';
import { UpdateBookingRequestDto } from './dto/update-booking-request.dto';
import { UpdateBookingRequestStatusDto } from './dto/update-booking-request-status.dto';
import { AssignBookingRequestDto } from './dto/assign-booking-request.dto';
import { ReopenBookingRequestDto } from './dto/reopen-booking-request.dto';
import { QueryBookingRequestsDto } from './dto/query-booking-requests.dto';
import { LinkBookingRequestDto } from '../clients/dto/link-booking-request.dto';

@Controller('admin/booking-requests')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class BookingRequestsController {
  constructor(
    private readonly bookingRequestsService: BookingRequestsService,
  ) {}

  @Get()
  findAll(
    @Query() query: QueryBookingRequestsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingRequestsService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bookingRequestsService.findOne(id);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.bookingRequestsService.getHistory(id);
  }

  // §3 — création manuelle (sollicitations reçues par téléphone/en
  // personne) : source = MANUAL_ENTRY forcé côté service.
  @Post()
  createManual(
    @Body() dto: CreateManualBookingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingRequestsService.createManual(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBookingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingRequestsService.update(id, dto, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBookingRequestStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingRequestsService.updateStatus(id, dto, user);
  }

  // Réservé SUPER_ADMIN — override le @Roles() de classe (voir §1 : un
  // statut terminal ne peut être quitté que par cette action dédiée).
  @Patch(':id/reopen')
  @Roles(Role.SUPER_ADMIN)
  reopen(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenBookingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingRequestsService.reopen(id, dto, user);
  }

  @Patch(':id/assign')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignBookingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingRequestsService.assign(id, dto, user);
  }

  @Patch(':id/link')
  link(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkBookingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingRequestsService.link(id, dto, user);
  }
}
