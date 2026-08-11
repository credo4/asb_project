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
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { CuratedListsService } from './curated-lists.service';
import { CreateCuratedListDto } from './dto/create-curated-list.dto';
import { UpdateCuratedListDto } from './dto/update-curated-list.dto';
import { UpdateCuratedListStatusDto } from './dto/update-curated-list-status.dto';
import { AddCuratedListMemberDto } from './dto/add-curated-list-member.dto';
import { ReorderCuratedListMembersDto } from './dto/reorder-curated-list-members.dto';
import { QueryCuratedListsDto } from './dto/query-curated-lists.dto';

// CRUD complet (§B3) — collections thématiques éditoriales, DISTINCTES du
// drapeau Speaker.isTopRequested (voir CLAUDE.md §6).
@Controller('admin/curated-lists')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class CuratedListsController {
  constructor(private readonly curatedListsService: CuratedListsService) {}

  @Get()
  findAll(@Query() query: QueryCuratedListsDto) {
    return this.curatedListsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.curatedListsService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateCuratedListDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curatedListsService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCuratedListDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curatedListsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curatedListsService.remove(id, user);
  }

  // Workflow de publication (§B3) — DRAFT <-> PUBLISHED.
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCuratedListStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curatedListsService.updateStatus(id, dto, user);
  }

  @Post(':id/members')
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddCuratedListMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curatedListsService.addMember(id, dto, user);
  }

  @Delete(':id/members/:speakerId')
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('speakerId', ParseIntPipe) speakerId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curatedListsService.removeMember(id, speakerId, user);
  }

  @Put(':id/members/reorder')
  reorderMembers(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderCuratedListMembersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curatedListsService.reorderMembers(id, dto, user);
  }
}
