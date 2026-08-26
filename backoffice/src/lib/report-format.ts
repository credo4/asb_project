// Petits utilitaires de formatage partagés par les 3 panneaux de /reports —
// fonctions pures, pas un composant : ne compte pas dans les "3 composants
// sur mesure" du système de design (voir CLAUDE.md §2b).
import type { ComparedValueDto } from './report-types';

const numberFormatter = new Intl.NumberFormat('fr-FR');

export function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

export function formatDeltaPercent(deltaPercent: number | null): string {
  if (deltaPercent === null) return 'stable (période précédente à zéro)';
  const sign = deltaPercent > 0 ? '+' : '';
  return `${sign}${deltaPercent.toFixed(1)} % vs période précédente`;
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export function deltaDirection(compared: ComparedValueDto): DeltaDirection {
  if (compared.deltaAbsolute > 0) return 'up';
  if (compared.deltaAbsolute < 0) return 'down';
  return 'flat';
}

// Une hausse n'est pas toujours "bonne" (ex: demandes annulées, délai de
// réponse) : chaque tuile déclare explicitement le sens qui lui convient
// plutôt que de le déduire du signe. `null` = neutre, aucune couleur de
// jugement (ex: chiffre d'affaires prévisionnel, qui n'est pas encore acquis).
export type GoodDirection = 'up' | 'down' | null;

export function deltaSeverity(
  compared: ComparedValueDto,
  goodDirection: GoodDirection,
): 'success' | 'danger' | 'neutral' {
  if (goodDirection === null) return 'neutral';
  const dir = deltaDirection(compared);
  if (dir === 'flat') return 'neutral';
  return dir === goodDirection ? 'success' : 'danger';
}

export function formatPercentValue(value: number): string {
  return `${value.toFixed(1)} %`;
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

// Résout un token de couleur ASB (voir styles/tokens.css) en valeur CSS
// concrète — chart.js ne comprend pas var(--asb-...) dans ses options JS,
// contrairement au CSS du reste de la page.
export function resolveToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
