import { SpeakerAvailabilityPeriod } from '@prisma/client';
import { AvailabilityPeriodDto } from '../dto/outputs/availability-period.dto';
import { TravelPreferencesDto } from '../dto/outputs/travel-preferences.dto';
import { TravelPreferenceRow } from '../speaker-availability.includes';

export function toPeriodDto(
  row: SpeakerAvailabilityPeriod,
): AvailabilityPeriodDto {
  return {
    id: row.id,
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPreferencesDto(
  row: TravelPreferenceRow,
): TravelPreferencesDto {
  return {
    travelScope: row.travelScope,
    countries: row.countries.map((c) => c.country),
    availableForVirtual: row.availableForVirtual,
    minimumNoticeDays: row.minimumNoticeDays,
    notes: row.notes,
    updatedAt: row.updatedAt,
  };
}

// Résumés restreints pour le journal d'activité (même philosophie que
// SpeakersService#scalarSnapshot : un audit humain, pas un diff complet).
export function scalarPeriodSnapshot(
  row: SpeakerAvailabilityPeriod,
): Record<string, unknown> {
  return {
    id: row.id,
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
  };
}

export function scalarPreferenceSnapshot(
  row: TravelPreferenceRow,
): Record<string, unknown> {
  return {
    travelScope: row.travelScope,
    availableForVirtual: row.availableForVirtual,
    minimumNoticeDays: row.minimumNoticeDays,
    countryIds: row.countries.map((c) => c.countryId),
  };
}
