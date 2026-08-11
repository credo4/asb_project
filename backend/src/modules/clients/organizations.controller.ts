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
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { QueryOrganizationsDto } from './dto/query-organizations.dto';
import { SuggestOrganizationsDto } from './dto/suggest-organizations.dto';

// Aucune route publique dans ce module (§A5) — réservé ADMIN/SUPER_ADMIN.
@Controller('admin/organizations')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get()
  findAll(@Query() query: QueryOrganizationsDto) {
    return this.service.findAll(query);
  }

  // Route littérale déclarée AVANT `:id` (même précaution que
  // GET /admin/speakers/available, cf. speakers.controller.ts) : ici les deux
  // routes vivent dans le MÊME contrôleur, donc l'ordre de déclaration des
  // méthodes suffit à garantir la résolution, sans dépendre d'aucun ordre
  // d'import de module.
  @Get('suggest')
  suggest(@Query() query: SuggestOrganizationsDto) {
    return this.service.suggest(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user);
  }
}
