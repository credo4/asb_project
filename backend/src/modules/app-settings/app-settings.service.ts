import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppSettings } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { CURRENT_TERMS_VERSION } from '../roster-applications/roster-application.constants';
import {
  DEFAULT_AGENCY_NAME,
  DEFAULT_CURRENCY,
  DEFAULT_RESPONSE_SLA_BUSINESS_DAYS,
} from './app-settings.constants';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';
import { AppSettingsDto } from './dto/outputs/app-settings.dto';

// Ligne UNIQUE (singleton) — voir schema.prisma#AppSettings. Pas de seed
// obligatoire : tant qu'aucun SUPER_ADMIN n'a rien enregistré, la ligne
// n'existe simplement pas et getEffectiveSettings() applique le repli
// intégral (jamais de ligne "vide" écrite au premier démarrage).
@Injectable()
export class AppSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly config: ConfigService,
  ) {}

  // Singleton : toujours la ligne id=1, jamais un `findFirst()` qui
  // dépendrait de l'ordre naturel — une seule ligne existera jamais, mais
  // fixer l'id rend l'upsert de update() ci-dessous sans ambiguïté.
  private static readonly SINGLETON_ID = 1;

  private async getRow(): Promise<AppSettings | null> {
    return this.prisma.appSettings.findUnique({
      where: { id: AppSettingsService.SINGLETON_ID },
    });
  }

  // Lecture INTERNE, réutilisée par d'autres modules (booking-requests,
  // missions, roster-applications, speaker-revisions) — voir CLAUDE.md
  // §A4 "remplace les valeurs codées en dur/.env par une lecture de cette
  // table, avec une valeur de repli". PAS de contrôle de rôle ici : c'est
  // un accès interne, pas une route HTTP (voir AppSettingsController pour
  // la version admin, restreinte).
  async getEffectiveSettings(): Promise<AppSettingsDto> {
    const row = await this.getRow();
    return {
      agencyName: row?.agencyName ?? DEFAULT_AGENCY_NAME,
      teamEmail:
        row?.teamEmail ?? this.config.get<string>('ASB_TEAM_EMAIL') ?? null,
      responseSlaBusinessDays:
        row?.responseSlaBusinessDays ?? DEFAULT_RESPONSE_SLA_BUSINESS_DAYS,
      defaultCurrency: row?.defaultCurrency ?? DEFAULT_CURRENCY,
      collaborationTermsVersion:
        row?.collaborationTermsVersion ?? CURRENT_TERMS_VERSION,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: null, // résolu séparément par getForAdmin() (évite un join ici)
    };
  }

  async getForAdmin(): Promise<AppSettingsDto> {
    const [effective, row] = await Promise.all([
      this.getEffectiveSettings(),
      this.getRow(),
    ]);
    if (!row?.updatedById) {
      return effective;
    }
    const updatedBy = await this.prisma.user.findUnique({
      where: { id: row.updatedById },
      select: { id: true, email: true },
    });
    return { ...effective, updatedBy };
  }

  // Journalise UNIQUEMENT les champs réellement changés, avant/après (§A4).
  async update(
    dto: UpdateAppSettingsDto,
    actor: AuthenticatedUser,
  ): Promise<AppSettingsDto> {
    const before = await this.getRow();

    const changed: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(dto) as (keyof UpdateAppSettingsDto)[]) {
      const nextValue = dto[key];
      if (nextValue === undefined) continue;
      const previousValue = before?.[key] ?? null;
      if (previousValue !== nextValue) {
        changed[key] = { before: previousValue, after: nextValue };
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const row = await tx.appSettings.upsert({
        where: { id: AppSettingsService.SINGLETON_ID },
        create: {
          id: AppSettingsService.SINGLETON_ID,
          ...dto,
          updatedById: actor.id,
        },
        update: { ...dto, updatedById: actor.id },
      });

      if (Object.keys(changed).length > 0) {
        await this.activityLog.record(tx, {
          actorId: actor.id,
          action: 'app_settings.updated',
          entityType: 'AppSettings',
          entityId: row.id,
          oldValue: Object.fromEntries(
            Object.entries(changed).map(([k, v]) => [k, v.before]),
          ),
          newValue: Object.fromEntries(
            Object.entries(changed).map(([k, v]) => [k, v.after]),
          ),
        });
      }
    });

    return this.getForAdmin();
  }
}
