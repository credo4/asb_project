import { AvailabilityPeriodType, TravelScope } from '@prisma/client';
import { periodsOverlap, daysBetween } from './availability-date.util';
import { AvailabilityCheckResult } from './availability-check.types';

interface PeriodLike {
  type: AvailabilityPeriodType;
  startDate: Date;
  endDate: Date;
}

interface PreferenceLike {
  travelScope: TravelScope;
  availableForVirtual: boolean;
  minimumNoticeDays: number;
  // ISO2 des pays couverts — seulement pertinent quand travelScope =
  // SELECTED_COUNTRIES (voir §3 des règles ci-dessous).
  countryIsos: string[];
}

export interface EvaluateAvailabilityParams {
  periods: PeriodLike[];
  preference: PreferenceLike | null;
  startDate: Date;
  endDate: Date;
  country: string | null;
  isVirtual: boolean;
  // Injecté plutôt que `new Date()` en interne : rend la fonction pure et
  // testable de façon déterministe (voir les tests e2e sur
  // minimumNoticeDays, qui ont besoin de contrôler "aujourd'hui").
  today: Date;
}

// Cœur métier des disponibilités (§17 du cahier des charges) — fonction
// PURE (aucun accès Prisma ici), appelée à la fois par
// SpeakerAvailabilityService#checkAvailability (un speaker) et par la
// recherche admin en masse (un speaker par itération, sans requête
// supplémentaire par speaker — voir searchAvailableSpeakers).
export function evaluateAvailability(
  params: EvaluateAvailabilityParams,
): AvailabilityCheckResult {
  const { periods, preference, startDate, endDate, country, isVirtual, today } =
    params;

  // "UNKNOWN" est réservé au speaker qui n'a RIEN déclaré du tout (ni
  // période, ni préférences) — modèle "disponible par défaut, sauf
  // exception" : l'absence de donnée ne doit JAMAIS se traduire par une
  // exclusion (§1). Dès qu'il y a la moindre donnée déclarée (une période OU
  // des préférences), on applique les règles ci-dessous et on conclut de
  // façon déterministe (AVAILABLE ou UNAVAILABLE), même si aucune période ne
  // chevauche la fenêtre demandée.
  const hasAnyDeclaredData = periods.length > 0 || preference !== null;
  if (!hasAnyDeclaredData) {
    return { status: 'UNKNOWN', reasons: [] };
  }

  // Règle n°1, PRIORITAIRE sur tout le reste : une période UNAVAILABLE qui
  // chevauche la fenêtre demandée l'emporte TOUJOURS, même si une période
  // AVAILABLE chevauche aussi la même fenêtre (cf. §1 : "UNAVAILABLE
  // l'emporte toujours sur AVAILABLE" — preuve par test e2e dédié).
  const overlappingUnavailable = periods.some(
    (p) =>
      p.type === AvailabilityPeriodType.UNAVAILABLE &&
      periodsOverlap(p, { startDate, endDate }),
  );
  if (overlappingUnavailable) {
    return {
      status: 'UNAVAILABLE',
      reasons: ['Période déclarée indisponible sur ce créneau.'],
    };
  }

  // Règle n°2 : délai minimum de réservation non respecté.
  const minimumNoticeDays = preference?.minimumNoticeDays ?? 0;
  const noticeDays = daysBetween(today, startDate);
  if (noticeDays < minimumNoticeDays) {
    return {
      status: 'UNAVAILABLE',
      reasons: [
        `Délai minimum de réservation non respecté (${minimumNoticeDays} jour(s) requis, ${Math.max(noticeDays, 0)} disponible(s)).`,
      ],
    };
  }

  // Règle n°3 : couverture géographique / virtuel. Une requête virtuelle ne
  // consulte JAMAIS travelScope (pas de déplacement requis) — seulement
  // availableForVirtual ; une requête physique consulte travelScope, jamais
  // availableForVirtual.
  if (isVirtual) {
    const availableForVirtual = preference?.availableForVirtual ?? true;
    if (!availableForVirtual) {
      return {
        status: 'UNAVAILABLE',
        reasons: ['Speaker non disponible pour une intervention virtuelle.'],
      };
    }
  } else {
    const travelScope = preference?.travelScope ?? TravelScope.WORLDWIDE;
    if (travelScope === TravelScope.NO_TRAVEL) {
      return {
        status: 'UNAVAILABLE',
        reasons: ['Speaker ne se déplace pas (travelScope = NO_TRAVEL).'],
      };
    }
    if (travelScope === TravelScope.SELECTED_COUNTRIES) {
      const countryIsos = preference?.countryIsos ?? [];
      if (!country || !countryIsos.includes(country)) {
        return {
          status: 'UNAVAILABLE',
          reasons: [
            country
              ? `Pays "${country}" hors de la liste de déplacement du speaker.`
              : 'Pays de destination requis pour vérifier la couverture de déplacement (travelScope = SELECTED_COUNTRIES).',
          ],
        };
      }
    }
  }

  return { status: 'AVAILABLE', reasons: [] };
}
