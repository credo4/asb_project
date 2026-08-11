import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { SpeakerRevisionsService } from './speaker-revisions.service';
import { QuerySpeakerRevisionsDto } from './dto/query-speaker-revisions.dto';
import { RequestChangesDto } from './dto/request-changes.dto';
import { RejectRevisionDto } from './dto/reject-revision.dto';

@Controller('admin/speaker-revisions')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminSpeakerRevisionsController {
  constructor(
    private readonly speakerRevisionsService: SpeakerRevisionsService,
  ) {}

  @Get()
  findAll(@Query() query: QuerySpeakerRevisionsDto) {
    return this.speakerRevisionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.speakerRevisionsService.findOne(id);
  }

  @Post(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.speakerRevisionsService.approve(id, user);
  }

  @Post(':id/request-changes')
  requestChanges(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RequestChangesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.speakerRevisionsService.requestChanges(id, dto, user);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectRevisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.speakerRevisionsService.reject(id, dto, user);
  }
}
