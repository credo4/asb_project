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
import { BookingRequestSpeakersService } from './booking-request-speakers.service';
import { AddBookingRequestSpeakerDto } from './dto/add-booking-request-speaker.dto';
import { UpdateBookingRequestSpeakerStatusDto } from './dto/update-booking-request-speaker-status.dto';
import { ReorderBookingRequestSpeakersDto } from './dto/reorder-booking-request-speakers.dto';
import { ReplaceBookingRequestSpeakerDto } from './dto/replace-booking-request-speaker.dto';

// Sélection de speakers candidats pour une demande (Phase 3d, §2) —
// ADMIN/SUPER_ADMIN uniquement, comme le reste de la gestion d'une demande.
@Controller('admin/booking-requests/:requestId/speakers')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class BookingRequestSpeakersController {
  constructor(private readonly service: BookingRequestSpeakersService) {}

  @Get()
  findAll(@Param('requestId', ParseIntPipe) requestId: number) {
    return this.service.findAll(requestId);
  }

  @Post()
  add(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: AddBookingRequestSpeakerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.add(requestId, dto, user);
  }

  @Put('reorder')
  reorder(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: ReorderBookingRequestSpeakersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reorder(requestId, dto, user);
  }

  @Delete(':speakerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Param('speakerId', ParseIntPipe) speakerId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(requestId, speakerId, user);
  }

  @Patch(':speakerId/status')
  updateStatus(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Param('speakerId', ParseIntPipe) speakerId: number,
    @Body() dto: UpdateBookingRequestSpeakerStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateStatus(requestId, speakerId, dto, user);
  }

  @Post(':speakerId/replace')
  replace(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Param('speakerId', ParseIntPipe) speakerId: number,
    @Body() dto: ReplaceBookingRequestSpeakerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.replace(requestId, speakerId, dto, user);
  }
}
