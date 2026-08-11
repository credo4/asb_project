-- Consolidation Phase 2, Partie A — deuxieme etape, separee de la fusion des
-- donnees (voir merge_speaker_media_into_assets) pour que chaque etape reste
-- relisible et rejouable independamment.
--
-- A ce stade, la table `speaker_media` (Phase 1) a deja ete supprimee par la
-- migration precedente : ce nom est donc libre. RENAME TABLE preserve
-- integralement les donnees, index et contraintes de cles etrangeres
-- (operation atomique cote MySQL/MariaDB, aucune perte).
RENAME TABLE `speaker_media_assets` TO `speaker_media`;
