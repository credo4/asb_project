import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpeakerStatus, TravelScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { resolveOwnSpeakerId } from '../speakers/resolve-own-speaker.util';
import { sanitizeOptionalText } from '../../common/utils/sanitize-text.util';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { UpsertTravelPreferencesDto } from './dto/upsert-travel-preferences.dto';
import { QueryAvailableSpeakersDto } from './dto/query-available-speakers.dto';
import { AvailabilityPeriodDto } from './dto/outputs/availability-period.dto';
import { TravelPreferencesDto } from './dto/outputs/travel-preferences.dto';
import { SpeakerAvailabilityDto } from './dto/outputs/speaker-availability.dto';
import { AvailableSpeakerItemDto } from './dto/outputs/available-speaker-item.dto';
import {
  TRAVEL_PREFERENCE_EVAL_SELECT,
  TRAVEL_PREFERENCE_INCLUDE,
} from './speaker-availability.includes';
import {
  scalarPeriodSnapshot,
  scalarPreferenceSnapshot,
  toPeriodDto,
  toPreferencesDto,
} from './mappers/speaker-availability.mapper';
import {
  daysBetween,
  parseDateOnly,
  startOfUtcDay,
} from './availability-date.util';
import { evaluateAvailability } from './evaluate-availability.util';
import { AvailabilityCheckResult } from './availability-check.types';
import {
  MAX_ACTIVE_PERIODS_PER_SPEAKER,
  MAX_PERIOD_DURATION_DAYS,
} from './speaker-availability.constants';

// -----------------------------------------------------------------------
// Pourquoi DATE plutôt que DATETIME (voir prisma/schema.prisma) :
// -----------------------------------------------------------------------
// Une disponibilité se raisonne à la journée ("indisponible du 3 au 7
// septembre"), jamais à l'heure près — DATETIME introduirait une précision
// dont personne n'a besoin, ET avec elle toute une classe de bugs de fuseau
// horaire : un "3 septembre 00:00" stocké en UTC devient "2 septembre 19:00"
// affiché à New York, un chevauchement calculé sur des DATETIME peut basculer
// selon l'heure de la requête plutôt que selon le jour métier, etc. Avec
// DATE, "3 septembre" reste "3 septembre" pour tout le monde, quel que soit
// le fuseau du serveur, du speaker ou de l'appelant — on ancre systématiquement
// à minuit UTC (voir parseDateOnly) pour ne jamais laisser un fuseau
// s'infiltrer dans la comparaison. Le fuseau du speaker (Speaker.timezone)
// sert à INTERPRÉTER "le 3 septembre chez lui", pas à stocker une heure.
@Injectable()
export class SpeakerAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ---------------------------------------------------------------------
  // Self-service SPEAKER
  // ---------------------------------------------------------------------

  async getOwn(actor: AuthenticatedUser): Promise<SpeakerAvailabilityDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    return this.getAvailability(speakerId);
  }

  async createOwnPeriod(
    actor: AuthenticatedUser,
    dto: CreatePeriodDto,
  ): Promise<AvailabilityPeriodDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    return this.createPeriod(speakerId, dto, actor);
  }

  async updateOwnPeriod(
    actor: AuthenticatedUser,
    id: number,
    dto: UpdatePeriodDto,
  ): Promise<AvailabilityPeriodDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    return this.updatePeriod(speakerId, id, dto, actor);
  }

  async removeOwnPeriod(actor: AuthenticatedUser, id: number): Promise<void> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    return this.removePeriod(speakerId, id, actor);
  }

  async upsertOwnPreferences(
    actor: AuthenticatedUser,
    dto: UpsertTravelPreferencesDto,
  ): Promise<TravelPreferencesDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    return this.upsertPreferences(speakerId, dto, actor);
  }

  // ---------------------------------------------------------------------
  // Admin — même logique métier, speakerId vient du chemin (:id), pas du
  // JWT. L'admin peut corriger n'importe quel profil ; toute écriture est
  // journalisée avec son propre acteur (voir ActivityLogService).
  // ---------------------------------------------------------------------

  async getForAdmin(speakerId: number): Promise<SpeakerAvailabilityDto> {
    await this.assertSpeakerExists(speakerId);
    return this.getAvailability(speakerId);
  }

  async createPeriodForAdmin(
    speakerId: number,
    dto: CreatePeriodDto,
    actor: AuthenticatedUser,
  ): Promise<AvailabilityPeriodDto> {
    await this.assertSpeakerExists(speakerId);
    return this.createPeriod(speakerId, dto, actor);
  }

  async updatePeriodForAdmin(
    speakerId: number,
    periodId: number,
    dto: UpdatePeriodDto,
    actor: AuthenticatedUser,
  ): Promise<AvailabilityPeriodDto> {
    await this.assertSpeakerExists(speakerId);
    return this.updatePeriod(speakerId, periodId, dto, actor);
  }

  async removePeriodForAdmin(
    speakerId: number,
    periodId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.assertSpeakerExists(speakerId);
    return this.removePeriod(speakerId, periodId, actor);
  }

  async upsertPreferencesForAdmin(
    speakerId: number,
    dto: UpsertTravelPreferencesDto,
    actor: AuthenticatedUser,
  ): Promise<TravelPreferencesDto> {
    await this.assertSpeakerExists(speakerId);
    return this.upsertPreferences(speakerId, dto, actor);
  }

  // ---------------------------------------------------------------------
  // Le point d'entrée prévu pour le matching de la Phase 3 (voir CLAUDE.md).
  // ---------------------------------------------------------------------

  async checkAvailability(
    speakerId: number,
    params: {
      startDate: Date;
      endDate: Date;
      country: string | null;
      isVirtual: boolean;
    },
  ): Promise<AvailabilityCheckResult> {
    const [periods, preference] = await Promise.all([
      // Toutes les périodes actives, PAS seulement celles qui chevauchent la
      // fenêtre demandée : "hasAnyDeclaredData" (UNKNOWN vs déterministe)
      // doit rester vrai même quand aucune période ne tombe dans la fenêtre
      // — voir evaluate-availability.util.ts.
      this.prisma.speakerAvailabilityPeriod.findMany({
        where: { speakerId, deletedAt: null },
        select: { type: true, startDate: true, endDate: true },
      }),
      this.prisma.speakerTravelPreference.findUnique({
        where: { speakerId },
        select: TRAVEL_PREFERENCE_EVAL_SELECT,
      }),
    ]);

    return evaluateAvailability({
      periods,
      preference: preference
        ? {
            travelScope: preference.travelScope,
            availableForVirtual: preference.availableForVirtual,
            minimumNoticeDays: preference.minimumNoticeDays,
            countryIsos: preference.countries.map((c) => c.country.iso2),
          }
        : null,
      startDate: params.startDate,
      endDate: params.endDate,
      country: params.country,
      isVirtual: params.isVirtual,
      today: startOfUtcDay(new Date()),
    });
  }

  // GET /admin/speakers/available — Phase 3 consommera ce même filtrage
  // directement. Un seul aller-retour DB (pas une requête checkAvailability
  // par speaker) : on charge périodes + préférences de tous les speakers
  // publiés en une fois, puis on applique la même fonction pure en mémoire.
  async searchAvailableSpeakers(
    query: QueryAvailableSpeakersDto,
  ): Promise<AvailableSpeakerItemDto[]> {
    const startDate = parseDateOnly(query.from);
    const endDate = parseDateOnly(query.to);
    if (startDate > endDate) {
      throw new BadRequestException(
        '"from" doit être antérieur ou égal à "to".',
      );
    }
    const isVirtual = query.isVirtual ?? false;
    const country = query.country ?? null;
    const today = startOfUtcDay(new Date());

    // status = PUBLISHED seulement, PAS de filtre sur isVisible : isVisible
    // masque un speaker publié du SITE PUBLIC (bascule manuelle), ça ne veut
    // pas dire qu'il faut aussi le cacher de cet outil interne — l'équipe
    // doit pouvoir matcher un speaker temporairement masqué du site pour une
    // négociation en cours (à la différence de publicSpeakerWhere(), voir
    // modules/public/public-speaker.constants.ts, qui exige les deux).
    const speakers = await this.prisma.speaker.findMany({
      where: { status: SpeakerStatus.PUBLISHED, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        publicName: true,
        slug: true,
        profilePhotoUrl: true,
        availabilityPeriods: {
          where: { deletedAt: null },
          select: { type: true, startDate: true, endDate: true },
        },
        travelPreference: { select: TRAVEL_PREFERENCE_EVAL_SELECT },
      },
    });

    const results: AvailableSpeakerItemDto[] = [];
    for (const speaker of speakers) {
      const evaluation = evaluateAvailability({
        periods: speaker.availabilityPeriods,
        preference: speaker.travelPreference
          ? {
              travelScope: speaker.travelPreference.travelScope,
              availableForVirtual: speaker.travelPreference.availableForVirtual,
              minimumNoticeDays: speaker.travelPreference.minimumNoticeDays,
              countryIsos: speaker.travelPreference.countries.map(
                (c) => c.country.iso2,
              ),
            }
          : null,
        startDate,
        endDate,
        country,
        isVirtual,
        today,
      });

      // On ne bloque pas une opportunité parce qu'un speaker n'a rien saisi
      // (§1) : UNKNOWN reste dans les résultats, seul UNAVAILABLE exclut.
      if (evaluation.status === 'UNAVAILABLE') {
        continue;
      }

      results.push({
        speaker: {
          id: speaker.id,
          displayName:
            speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`,
          slug: speaker.slug,
          profilePhotoUrl: speaker.profilePhotoUrl,
        },
        status: evaluation.status,
        reasons: evaluation.reasons,
      });
    }

    return results;
  }

  // ---------------------------------------------------------------------
  // Implémentation partagée (self-service ET admin) — le scoping par
  // speakerId est déjà résolu par l'appelant (resolveOwnSpeakerId ou :id
  // admin déjà vérifié via assertSpeakerExists) : toujours
  // where: { id, speakerId, deletedAt: null }, jamais un findUnique({ id })
  // suivi d'un contrôle après coup (même règle qu'en 2b — un id d'un autre
  // speaker doit produire 404, pas 403, côté self-service ; côté admin
  // c'est simplement une histoire d'intégrité des données, pas de
  // confidentialité, mais le même scoping protège des deux).
  // ---------------------------------------------------------------------

  private async getAvailability(
    speakerId: number,
  ): Promise<SpeakerAvailabilityDto> {
    const [periods, preference] = await Promise.all([
      this.prisma.speakerAvailabilityPeriod.findMany({
        where: { speakerId, deletedAt: null },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.speakerTravelPreference.findUnique({
        where: { speakerId },
        include: TRAVEL_PREFERENCE_INCLUDE,
      }),
    ]);

    return {
      periods: periods.map(toPeriodDto),
      preferences: preference ? toPreferencesDto(preference) : null,
    };
  }

  private async createPeriod(
    speakerId: number,
    dto: CreatePeriodDto,
    actor: AuthenticatedUser,
  ): Promise<AvailabilityPeriodDto> {
    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);
    this.assertValidPeriodDates(startDate, endDate);

    const created = await this.prisma.$transaction(async (tx) => {
      const activeCount = await tx.speakerAvailabilityPeriod.count({
        where: { speakerId, deletedAt: null },
      });
      if (activeCount >= MAX_ACTIVE_PERIODS_PER_SPEAKER) {
        throw new BadRequestException(
          `Quota atteint : ${MAX_ACTIVE_PERIODS_PER_SPEAKER} périodes actives maximum par profil.`,
        );
      }

      // Chevauchements AUTORISÉS (la règle de priorité les résout, voir
      // evaluate-availability.util.ts) — seul un DOUBLON EXACT est rejeté.
      const duplicate = await tx.speakerAvailabilityPeriod.findFirst({
        where: {
          speakerId,
          deletedAt: null,
          type: dto.type,
          startDate,
          endDate,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException(
          "Cette période existe déjà à l'identique (même type, mêmes dates).",
        );
      }

      const row = await tx.speakerAvailabilityPeriod.create({
        data: {
          speakerId,
          type: dto.type,
          startDate,
          endDate,
          reason: sanitizeOptionalText(dto.reason),
        },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_availability.period_created',
        entityType: 'SpeakerAvailabilityPeriod',
        entityId: row.id,
        oldValue: null,
        newValue: scalarPeriodSnapshot(row),
      });

      return row;
    });

    return toPeriodDto(created);
  }

  private async updatePeriod(
    speakerId: number,
    id: number,
    dto: UpdatePeriodDto,
    actor: AuthenticatedUser,
  ): Promise<AvailabilityPeriodDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.speakerAvailabilityPeriod.findFirst({
        where: { id, speakerId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Période ${id} introuvable.`);
      }

      const startDate =
        dto.startDate !== undefined
          ? parseDateOnly(dto.startDate)
          : existing.startDate;
      const endDate =
        dto.endDate !== undefined
          ? parseDateOnly(dto.endDate)
          : existing.endDate;
      const type = dto.type ?? existing.type;
      this.assertValidPeriodDates(startDate, endDate);

      const duplicate = await tx.speakerAvailabilityPeriod.findFirst({
        where: {
          speakerId,
          deletedAt: null,
          type,
          startDate,
          endDate,
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException(
          "Cette période existe déjà à l'identique (même type, mêmes dates).",
        );
      }

      const row = await tx.speakerAvailabilityPeriod.update({
        where: { id },
        data: {
          type,
          startDate,
          endDate,
          reason:
            dto.reason !== undefined
              ? sanitizeOptionalText(dto.reason)
              : undefined,
        },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_availability.period_updated',
        entityType: 'SpeakerAvailabilityPeriod',
        entityId: id,
        oldValue: scalarPeriodSnapshot(existing),
        newValue: scalarPeriodSnapshot(row),
      });

      return row;
    });

    return toPeriodDto(updated);
  }

  private async removePeriod(
    speakerId: number,
    id: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.speakerAvailabilityPeriod.findFirst({
        where: { id, speakerId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Période ${id} introuvable.`);
      }

      const deletedAt = new Date();
      await tx.speakerAvailabilityPeriod.update({
        where: { id },
        data: { deletedAt },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_availability.period_deleted',
        entityType: 'SpeakerAvailabilityPeriod',
        entityId: id,
        oldValue: { deletedAt: null },
        newValue: { deletedAt: deletedAt.toISOString() },
      });
    });
  }

  private async upsertPreferences(
    speakerId: number,
    dto: UpsertTravelPreferencesDto,
    actor: AuthenticatedUser,
  ): Promise<TravelPreferencesDto> {
    const countryIds =
      dto.travelScope === TravelScope.SELECTED_COUNTRIES
        ? (dto.countryIds ?? [])
        : [];

    const updated = await this.prisma.$transaction(async (tx) => {
      if (countryIds.length > 0) {
        const validCount = await tx.country.count({
          where: { id: { in: countryIds } },
        });
        if (validCount !== countryIds.length) {
          throw new BadRequestException(
            'countryIds contient au moins un pays inconnu.',
          );
        }
      }

      const existing = await tx.speakerTravelPreference.findUnique({
        where: { speakerId },
        include: TRAVEL_PREFERENCE_INCLUDE,
      });

      const availableForVirtual = dto.availableForVirtual ?? true;
      const minimumNoticeDays = dto.minimumNoticeDays ?? 0;
      const notes = sanitizeOptionalText(dto.notes) ?? null;

      const row = await tx.speakerTravelPreference.upsert({
        where: { speakerId },
        create: {
          speakerId,
          travelScope: dto.travelScope,
          availableForVirtual,
          minimumNoticeDays,
          notes,
          countries: countryIds.length
            ? { create: countryIds.map((countryId) => ({ countryId })) }
            : undefined,
        },
        update: {
          travelScope: dto.travelScope,
          availableForVirtual,
          minimumNoticeDays,
          notes,
          // Remplacement complet (cohérent avec la sémantique PUT du DTO) :
          // on purge puis on réinsère, comme pour les autres relations
          // many-to-many du projet (voir SpeakersService#buildUpdateData).
          countries: {
            deleteMany: {},
            create: countryIds.map((countryId) => ({ countryId })),
          },
        },
        include: TRAVEL_PREFERENCE_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_availability.preferences_updated',
        entityType: 'SpeakerTravelPreference',
        entityId: row.id,
        oldValue: existing ? scalarPreferenceSnapshot(existing) : null,
        newValue: scalarPreferenceSnapshot(row),
      });

      return row;
    });

    return toPreferencesDto(updated);
  }

  private async assertSpeakerExists(speakerId: number): Promise<void> {
    const speaker = await this.prisma.speaker.findFirst({
      where: { id: speakerId, deletedAt: null },
      select: { id: true },
    });
    if (!speaker) {
      throw new NotFoundException(`Speaker ${speakerId} introuvable.`);
    }
  }

  // startDate ≤ endDate ; endDate pas dans le passé (on ne planifie pas
  // hier) ; durée maximale 2 ans (voir speaker-availability.constants.ts).
  private assertValidPeriodDates(startDate: Date, endDate: Date): void {
    if (startDate > endDate) {
      throw new BadRequestException(
        'startDate doit être antérieure ou égale à endDate.',
      );
    }
    const today = startOfUtcDay(new Date());
    if (endDate < today) {
      throw new BadRequestException('endDate ne peut pas être dans le passé.');
    }
    const durationDays = daysBetween(startDate, endDate);
    if (durationDays > MAX_PERIOD_DURATION_DAYS) {
      throw new BadRequestException(
        `Durée maximale d'une période : ${MAX_PERIOD_DURATION_DAYS} jours (2 ans).`,
      );
    }
  }
}
