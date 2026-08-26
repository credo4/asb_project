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
import { UsersService } from './users.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { CreateUserInviteDto } from './dto/create-user-invite.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeactivateUserDto } from './dto/deactivate-user.dto';
import { InviteUserResultDto } from './dto/outputs/invite-user-result.dto';

// §A1 — lecture ouverte à ADMIN, écriture (invitation/édition/désactivation)
// réservée SUPER_ADMIN (@Roles au niveau contrôleur = défaut lecture,
// surchargé par méthode pour les 3 routes d'écriture).
@Controller('admin/users')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.service.findAllForAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneForAdmin(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  invite(
    @Body() dto: CreateUserInviteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InviteUserResultDto> {
    return this.service.invite(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/deactivate')
  @Roles(Role.SUPER_ADMIN)
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeactivateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deactivate(id, dto, user);
  }
}
