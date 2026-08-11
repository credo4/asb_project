import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { SpeakerMediaService } from './speaker-media.service';
import { QuerySpeakerMediaDto } from './dto/query-speaker-media.dto';
import { ReviewMediaDto } from './dto/review-media.dto';

@Controller('admin/speaker-media')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminSpeakerMediaController {
  constructor(private readonly service: SpeakerMediaService) {}

  @Get()
  findAll(@Query() query: QuerySpeakerMediaDto) {
    return this.service.findAllForAdmin(query);
  }

  @Patch(':id/review')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reviewAsAdmin(id, dto, user);
  }
}
