import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';

@Controller('admin/booking-requests/:requestId/reminders')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class RemindersController {
  constructor(private readonly service: RemindersService) {}

  @Get()
  findAll(@Param('requestId', ParseIntPipe) requestId: number) {
    return this.service.listForRequest(requestId);
  }

  @Post()
  create(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: CreateReminderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(requestId, dto, user);
  }

  @Patch(':reminderId/done')
  markDone(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Param('reminderId', ParseIntPipe) reminderId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.markDone(requestId, reminderId, user);
  }
}
