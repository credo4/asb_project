-- Consolidation avant la suite de la Phase 3, Partie B — listes éditoriales
-- (curated lists), cf. cahier des charges §10.4. Entité manquante : ni
-- table, ni endpoint n'existaient avant cette migration.
--
-- Le bloc "speaker_media" (ALTER COLUMN updated_at DROP DEFAULT) que
-- `prisma migrate diff` continue de proposer est OMIS ici, comme dans
-- toutes les migrations précédentes depuis la consolidation Phase 2 :
-- artefact cosmétique sans rapport, sans perte de données.

CREATE TABLE `curated_lists` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(220) NOT NULL,
    `description` TEXT NULL,
    `image_url` VARCHAR(500) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `published_at` DATETIME(3) NULL,
    `selection_mode` ENUM('MANUAL', 'AUTO') NOT NULL DEFAULT 'MANUAL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `curated_lists_slug_key`(`slug`),
    INDEX `curated_lists_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Table de jonction, même pattern que speaker_pillars/speaker_formats.
CREATE TABLE `curated_list_speakers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `list_id` INTEGER NOT NULL,
    `speaker_id` INTEGER NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `curated_list_speakers_speaker_id_idx`(`speaker_id`),
    UNIQUE INDEX `curated_list_speakers_list_id_speaker_id_key`(`list_id`, `speaker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `curated_list_speakers`
  ADD CONSTRAINT `curated_list_speakers_list_id_fkey`
  FOREIGN KEY (`list_id`) REFERENCES `curated_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `curated_list_speakers`
  ADD CONSTRAINT `curated_list_speakers_speaker_id_fkey`
  FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
