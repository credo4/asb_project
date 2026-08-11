import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalDiskStorageService } from './local-disk-storage.service';

// `@Global()` comme PrismaModule/MailModule : un seul StorageService partagé.
// Le binding `provide: StorageService, useClass: LocalDiskStorageService`
// est ce qui permet au reste de l'app d'injecter l'abstraction (StorageService)
// sans jamais connaître l'implémentation concrète — pour passer à un stockage
// cloud plus tard, seule cette ligne change.
@Global()
@Module({
  providers: [{ provide: StorageService, useClass: LocalDiskStorageService }],
  exports: [StorageService],
})
export class StorageModule {}
