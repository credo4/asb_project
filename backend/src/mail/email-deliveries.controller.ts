import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { EmailDeliveriesService } from './email-deliveries.service';
import { QueryEmailDeliveriesDto } from './dto/query-email-deliveries.dto';

// §E — visibilité UNIQUEMENT (pas de réessai automatique) : une panne SMTP
// ne doit plus passer inaperçue des semaines.
@Controller('admin/email-deliveries')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class EmailDeliveriesController {
  constructor(private readonly service: EmailDeliveriesService) {}

  @Get()
  findAll(@Query() query: QueryEmailDeliveriesDto) {
    return this.service.findAllForAdmin(query);
  }
}
