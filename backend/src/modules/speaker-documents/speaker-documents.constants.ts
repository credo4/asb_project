export const DOCUMENT_QUOTA_PER_SPEAKER = 10;

export const DOCUMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo

export const DOCUMENT_SUBDIR = 'documents';

// Défaut général (garde 5 minutes, cf. Phase 2c) — utilisé si aucun TTL plus
// spécifique n'est configuré.
export const DEFAULT_FILE_SIGNING_TTL_SECONDS = 300;

// Documents privés (CV, attestations) : fenêtre plus courte que le défaut
// général — un lien de document n'a pas besoin de vivre aussi longtemps
// qu'un lien de média (Phase 2, consolidation, Partie B).
export const DEFAULT_FILE_SIGNING_TTL_DOCUMENTS_SECONDS = 60;
