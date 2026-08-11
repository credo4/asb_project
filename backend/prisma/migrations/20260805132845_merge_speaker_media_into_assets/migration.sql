-- Consolidation Phase 2, Partie A — fusion des deux tables de medias publics
-- ("speaker_media" Phase 1, admin-curee <-> "speaker_media_assets" Phase 2b,
-- libre-service) en une seule source de verite. Rejouable sans perte sur une
-- base contenant deja des lignes : chaque etape est explicite et se contente
-- de lire/deplacer des donnees existantes, jamais de generer une donnee
-- fictive. Deuxieme migration separee (rename_speaker_media_assets_to_speaker_media)
-- pour le renommage final de la table, afin que chaque etape reste relisible
-- et rejouable independamment.

-- 1) Nouvelle colonne requise par le schema cible (absente de
--    speaker_media_assets jusqu'ici) : DEFAULT CURRENT_TIMESTAMP(3) backfill
--    automatiquement les lignes deja existantes, ON UPDATE la maintient a jour
--    ensuite (equivalent de @updatedAt cote Prisma).
ALTER TABLE `speaker_media_assets`
  ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- 2) Fusion des donnees : chaque ligne de l'ancienne table admin-curee
--    devient une ligne de la table en libre-service.
--
--    - status : un media cree par un admin est repute deja approuve (ecriture
--      directe = validation immediate, meme regle que le CRUD post-fusion,
--      voir A3) SAUF si l'admin l'avait explicitement marque non-public
--      (is_public = 0) : dans ce cas il atterrit en REJECTED, jamais en
--      APPROVED, pour ne RIEN rendre visible qui ne l'etait pas deja.
--    - reviewed_at = created_at, reviewed_by_id = NULL : aucun acteur connu
--      retroactivement, plus honnete que d'inventer une attribution.
--    - thumbnail_url / caption : absents de l'ancienne table, restent NULL.
--    - type : mapping des 11 valeurs historiques vers les 3 valeurs du
--      systeme unifie (PHOTO / VIDEO / PRESS_KIT) - hypothese raisonnable en
--      l'absence de mapping impose par le cahier des charges :
--        GALLERY_PHOTO, LOGO                                    -> PHOTO
--        VIDEO, DEMO_REEL, KEYNOTE_EXCERPT, PODCAST, INTERVIEW   -> VIDEO
--        PRESS_KIT, PDF_DOCUMENT, PRESENTATION, DOWNLOADABLE_BIO -> PRESS_KIT
--    - url : l'ancienne table avait DEUX champs distincts (`url` pour les
--      liens externes, `file_path` pour les fichiers heberges), la nouvelle
--      n'en a qu'un — COALESCE(url, file_path, '') : priorite a `url`, sinon
--      `file_path` copie TEL QUEL (aucune reecriture de chemin, on ne peut
--      pas savoir de maniere fiable s'il s'agissait deja d'une URL complete
--      ou d'un chemin relatif). Verifier apres migration :
--        SELECT id, speaker_id, url FROM speaker_media_assets
--        WHERE url = '' OR url NOT LIKE 'http%';
INSERT INTO `speaker_media_assets`
  (`speaker_id`, `type`, `url`, `thumbnail_url`, `title`, `caption`,
   `display_order`, `status`, `reviewed_at`, `reviewed_by_id`,
   `rejection_reason`, `created_at`, `updated_at`, `deleted_at`)
SELECT
  `speaker_id`,
  CASE `type`
    WHEN 'GALLERY_PHOTO'     THEN 'PHOTO'
    WHEN 'LOGO'              THEN 'PHOTO'
    WHEN 'VIDEO'             THEN 'VIDEO'
    WHEN 'DEMO_REEL'         THEN 'VIDEO'
    WHEN 'KEYNOTE_EXCERPT'   THEN 'VIDEO'
    WHEN 'PODCAST'           THEN 'VIDEO'
    WHEN 'INTERVIEW'         THEN 'VIDEO'
    WHEN 'PRESS_KIT'         THEN 'PRESS_KIT'
    WHEN 'PDF_DOCUMENT'      THEN 'PRESS_KIT'
    WHEN 'PRESENTATION'      THEN 'PRESS_KIT'
    WHEN 'DOWNLOADABLE_BIO'  THEN 'PRESS_KIT'
    ELSE 'PRESS_KIT'
  END AS `type`,
  COALESCE(`url`, `file_path`, '') AS `url`,
  NULL AS `thumbnail_url`,
  `title`,
  NULL AS `caption`,
  `display_order`,
  CASE WHEN `is_public` = 1 THEN 'APPROVED' ELSE 'REJECTED' END AS `status`,
  `created_at` AS `reviewed_at`,
  NULL AS `reviewed_by_id`,
  CASE
    WHEN `is_public` = 1 THEN NULL
    ELSE 'Média non public au moment de la fusion Phase 1 -> table unique (migration automatique, aucun motif original disponible).'
  END AS `rejection_reason`,
  `created_at`,
  `created_at` AS `updated_at`,
  NULL AS `deleted_at`
FROM `speaker_media`;

-- 3) Renumerotation de displayOrder PAR SPEAKER, sur la table entiere
--    (lignes d'origine Phase 2b + lignes qu'on vient d'inserer) : evite toute
--    collision d'ordre d'affichage entre les deux anciennes origines. Ordre
--    stable par (display_order existant, created_at), renumerote de 0 a N-1.
UPDATE `speaker_media_assets` `sma`
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (PARTITION BY `speaker_id` ORDER BY `display_order` ASC, `created_at` ASC) - 1 AS `new_order`
  FROM `speaker_media_assets`
) AS `ranked` ON `sma`.`id` = `ranked`.`id`
SET `sma`.`display_order` = `ranked`.`new_order`;

-- 4) L'ancienne table n'a plus de raison d'exister : toutes ses lignes ont
--    ete copiees a l'etape 2.
DROP TABLE `speaker_media`;
