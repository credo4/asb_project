// Échappe les caractères HTML spéciaux avant stockage. Ces champs texte
// libres viennent du public (sans authentification) et finiront un jour par
// être affichés dans le back-office : on neutralise à la SOURCE plutôt que
// de compter sur chaque futur écran admin pour bien échapper son rendu.
export function sanitizeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Variante pour les champs optionnels : évite de répéter `value ? sanitizeText(value) : value`
// à chaque appel dans les services d'ingestion.
export function sanitizeOptionalText(
  value: string | null | undefined,
): string | null | undefined {
  return value === null || value === undefined ? value : sanitizeText(value);
}
