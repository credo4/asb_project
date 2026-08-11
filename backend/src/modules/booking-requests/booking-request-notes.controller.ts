import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { BookingRequestNotesService } from './booking-request-notes.service';
import { CreateBookingRequestNoteDto } from './dto/create-booking-request-note.dto';

// Une note interne ne doit JAMAIS sortir du périmètre ADMIN/SUPER_ADMIN
// (§2.3) — jamais de route publique, jamais un rôle SPEAKER.
@Controller('admin/booking-requests/:requestId/notes')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class BookingRequestNotesController {
  constructor(private readonly service: BookingRequestNotesService) {}

  @Post()
  create(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: CreateBookingRequestNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(requestId, dto, user);
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(requestId, noteId, user);
  }
}
