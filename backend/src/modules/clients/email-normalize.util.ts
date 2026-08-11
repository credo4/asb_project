// Normalisation UNIQUE, partagée par tous les points d'écriture qui touchent
// à `Contact.normalizedEmail` (rattachement auto à la création d'une
// booking_request, création manuelle d'un contact, endpoint de link,
// backfill) : minuscules + trim, rien d'autre — cf. §A3/§A4 du prompt.
// Un seul endroit qui décide de la règle évite qu'une variante subtile
// (espace insécable, casse) fasse échapper deux emails "identiques" à la
// contrainte d'unicité en base.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
