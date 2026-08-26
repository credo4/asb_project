// §A6 — export CSV générique, réutilisé par les 3 rapports. Volontairement
// minimal (pas de dépendance externe) : échappement RFC 4180 (guillemets
// doublés, champ entre guillemets si virgule/guillemet/retour à la ligne),
// BOM UTF-8 en tête pour qu'Excel n'affiche pas les accents en charabia.
function stringifyCell(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value instanceof Date) return value.toISOString();
  // Objet inattendu dans une cellule CSV (ne devrait pas arriver avec des
  // colonnes bien typées) : JSON plutôt que le `[object Object]` par défaut.
  return JSON.stringify(value);
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = stringifyCell(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.value(row))).join(','),
  );
  return '﻿' + [header, ...lines].join('\r\n');
}
