-- Consolidation avant la suite de la Phase 3, Partie C — référencer le
-- speaker/la liste éditoriale par SLUG dans POST /public/analytics/events,
-- résolus côté serveur en identifiants internes avant enregistrement.
-- Cette migration ajoute la colonne miroir de `speaker_id` pour
-- CURATED_LIST_VIEW : `curated_list_id`.
--
-- Le bloc "speaker_media" (ALTER COLUMN updated_at DROP DEFAULT) est OMIS,
-- comme dans toutes les migrations précédentes — artefact cosmétique sans
-- rapport, sans perte de données.

ALTER TABLE `analytics_events`
  ADD COLUMN `curated_list_id` INTEGER NULL;

CREATE INDEX `analytics_events_curated_list_id_idx` ON `analytics_events`(`curated_list_id`);

ALTER TABLE `analytics_events`
  ADD CONSTRAINT `analytics_events_curated_list_id_fkey`
  FOREIGN KEY (`curated_list_id`) REFERENCES `curated_lists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
