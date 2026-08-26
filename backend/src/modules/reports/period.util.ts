import { BadRequestException } from '@nestjs/common';
import { DEFAULT_PERIOD_DAYS } from './reports.constants';

export interface ReportPeriod {
  from: Date;
  to: Date;
}

// §A1 — "un chiffre seul ne veut rien dire" : la période PRÉCÉDENTE, de
// MÊME DURÉE, immédiatement avant `current.from`. Un mois de 31 jours
// comparé à un mois de 28 serait déjà trompeur — la durée est donc
// calculée en millisecondes, jamais en "mois précédent" au sens calendaire.
export function resolvePeriods(
  fromParam?: string,
  toParam?: string,
): { current: ReportPeriod; previous: ReportPeriod } {
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException(
      '`from`/`to` doivent être des dates valides (ISO 8601).',
    );
  }
  if (from >= to) {
    throw new BadRequestException('`from` doit être antérieur à `to`.');
  }

  const durationMs = to.getTime() - from.getTime();
  const previous: ReportPeriod = {
    from: new Date(from.getTime() - durationMs),
    to: from,
  };

  return { current: { from, to }, previous };
}

export interface ComparedValue {
  current: number;
  previous: number;
  deltaAbsolute: number;
  // null si `previous` est 0 (une variation en % de zéro n'a pas de sens
  // — jamais affichée comme "+Infinity%"/"NaN%").
  deltaPercent: number | null;
}

export function compare(current: number, previous: number): ComparedValue {
  const deltaAbsolute = current - previous;
  const deltaPercent = previous !== 0 ? (deltaAbsolute / previous) * 100 : null;
  return { current, previous, deltaAbsolute, deltaPercent };
}
