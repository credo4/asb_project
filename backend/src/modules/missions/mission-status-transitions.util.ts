import { MissionStatus } from '@prisma/client';

// §3 — POINT PRATIQUE IMPORTANT du prompt : la séquence du cahier des
// charges (§8) est idéalisée. Dans la vraie vie, une mission saute des
// étapes (pas d'acompte demandé, contrat signé avant le devis formel) —
// voir l'explication donnée à l'utilisateur pour le raisonnement complet.
// Une matrice de paires écrites à la main (comme BookingStatus/
// ApplicationStatus/BookingRequestSpeakerStatus) serait donc soit FAUSSE
// (si elle n'autorisait que la séquence idéale) soit ÉNORME et redondante
// (si elle listait TOUTE paire (from, to) avec to "plus avancé" que from —
// pour 14 statuts, jusqu'à 91 paires à énumérer à la main pour exprimer une
// seule règle : "en avant, oui ; en arrière, non"). Un ORDRE TOTAL (rang)
// exprime directement cette règle par comparaison numérique — toujours
// UNE SEULE structure de données explicite (l'ordre ci-dessous), jamais des
// `if` dispersés, exactement l'esprit de la 3b/3d, juste un encodage plus
// adapté à CETTE règle-ci (comparer des rangs plutôt qu'énumérer des
// paires).
//
// CANCELLED n'a PAS de rang dans cet ordre : traité à part (atteignable
// depuis n'importe quel statut non terminal, motif obligatoire — voir
// isMissionTransitionAllowed). COMPLETED est le dernier rang : une fois
// atteint, plus aucune transition (terminal, comme CANCELLED).
const STATUS_ORDER: MissionStatus[] = [
  MissionStatus.PREPARATION,
  MissionStatus.AVAILABILITY_CONFIRMED,
  MissionStatus.QUOTE_SENT,
  MissionStatus.QUOTE_ACCEPTED,
  MissionStatus.CONTRACT_SENT,
  MissionStatus.CONTRACT_SIGNED,
  MissionStatus.DEPOSIT_EXPECTED,
  MissionStatus.DEPOSIT_RECEIVED,
  MissionStatus.LOGISTICS_IN_PROGRESS,
  MissionStatus.CONFIRMED,
  MissionStatus.DELIVERED,
  MissionStatus.SPEAKER_PAYMENT_PENDING,
  MissionStatus.COMPLETED,
];

export const TERMINAL_MISSION_STATUSES: MissionStatus[] = [
  MissionStatus.COMPLETED,
  MissionStatus.CANCELLED,
];

export function isTerminalMissionStatus(status: MissionStatus): boolean {
  return TERMINAL_MISSION_STATUSES.includes(status);
}

function rank(status: MissionStatus): number {
  return STATUS_ORDER.indexOf(status);
}

// §3 — CANCELLED est atteignable depuis TOUT statut non terminal (motif
// obligatoire, validé côté service). Les sauts EN AVANT (rang strictement
// supérieur) sont TOUJOURS permis, quel que soit l'acteur. Les retours en
// arrière (rang strictement inférieur) sont réservés SUPER_ADMIN — voir
// `isSuperAdmin`, jamais un second chemin de validation.
export function isMissionTransitionAllowed(
  from: MissionStatus,
  to: MissionStatus,
  isSuperAdmin: boolean,
): boolean {
  if (from === to) {
    return true; // no-op toléré (idempotent)
  }
  if (isTerminalMissionStatus(from)) {
    return false; // ni COMPLETED ni CANCELLED ne rouvrent (pas demandé ici)
  }
  if (to === MissionStatus.CANCELLED) {
    return true;
  }
  if (isTerminalMissionStatus(to)) {
    // to === COMPLETED ici (CANCELLED déjà traité ci-dessus) : un rang
    // valide comme n'importe quel autre saut en avant.
    return rank(to) > rank(from) || isSuperAdmin;
  }
  const forward = rank(to) > rank(from);
  return forward || isSuperAdmin;
}

// Message d'erreur explicite (même esprit que getAllowedTransitions en 3b) :
// liste tous les statuts atteignables EN AVANT depuis `from`, plus CANCELLED
// — pas les statuts "en arrière" (réservés SUPER_ADMIN, cas à part).
export function getForwardMissionTransitions(
  from: MissionStatus,
): MissionStatus[] {
  if (isTerminalMissionStatus(from)) {
    return [];
  }
  const fromRank = rank(from);
  const forward = STATUS_ORDER.filter((_, index) => index > fromRank);
  return [...forward, MissionStatus.CANCELLED];
}
