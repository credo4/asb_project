// `booking_requests.fullName` est UN champ texte (voir CLAUDE.md — donnée
// d'intake immuable), alors que `Contact` distingue firstName/lastName.
// Hypothèse raisonnable, non spécifiée par le cahier des charges : on coupe
// sur le DERNIER espace (le dernier "mot" devient lastName, le reste
// firstName) — ça gère mieux les prénoms composés ("Jean Paul Fofana" ->
// firstName "Jean Paul", lastName "Fofana") qu'une coupe sur le premier
// espace. Sans espace du tout, tout part dans firstName et lastName reste
// vide — l'admin peut corriger après coup via PATCH /admin/contacts/:id.
export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  const lastSpaceIndex = trimmed.lastIndexOf(' ');
  if (lastSpaceIndex === -1) {
    return { firstName: trimmed, lastName: '' };
  }
  return {
    firstName: trimmed.slice(0, lastSpaceIndex).trim(),
    lastName: trimmed.slice(lastSpaceIndex + 1).trim(),
  };
}
