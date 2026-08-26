import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AppSettingsService } from './app-settings.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

// §A4 — lecture ADMIN, écriture SUPER_ADMIN.
@Controller('admin/settings')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AppSettingsController {
  constructor(private readonly service: AppSettingsService) {}

  @Get()
  get() {
    return this.service.getForAdmin();
  }

  @Patch()
  @Roles(Role.SUPER_ADMIN)
  update(
    @Body() dto: UpdateAppSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(dto, user);
  }
}
