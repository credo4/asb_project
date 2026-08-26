import { Global, Module } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { AppSettingsController } from './app-settings.controller';

// @Global() : AppSettingsService#getEffectiveSettings() est lu depuis
// plusieurs modules métier sans lien entre eux (booking-requests, missions,
// roster-applications, speaker-revisions) — même raison que PrismaModule/
// ActivityLogModule, éviter de le réimporter partout.
@Global()
@Module({
  controllers: [AppSettingsController],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
