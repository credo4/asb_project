// Correspondance par SOUS-CHAÎNE insensible à la casse (collation MySQL par
// défaut, cf. speakers.service.ts#buildWhere) — pas une vraie similarité
// floue/Levenshtein. Suffisant pour repérer un doublon évident à la saisie
// ("African Bank" vs "Africa Bank Corp") ; une vraie tolérance aux fautes de
// frappe reste une amélioration future, pas construite ici.
export class OrganizationSuggestionDto {
  id!: number;
  name!: string;
  sector!: string | null;
}
