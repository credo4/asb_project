import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// `OnModuleInit`/`OnModuleDestroy` sont des "lifecycle hooks" NestJS :
// des méthodes que Nest appelle automatiquement au démarrage et à l'arrêt
// de l'application, ce qui permet d'ouvrir/fermer proprement la connexion DB.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connexion Prisma établie');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
