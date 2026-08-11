-- Phase 3, étape 3c — candidatures, évaluation et conversion en compte
-- speaker (cf. cahier des charges §5). Suit fidèlement le pattern de
-- add_booking_request_workflow (Phase 3b) : renommage d'enum sans backfill,
-- nouvelles tables réutilisant la brique de stockage privé de la Phase 2c.
--
-- Le bloc "speaker_media_assets -> speaker_media" (FK/index legacy) que
-- `prisma migrate diff` continue de proposer à chaque nouvelle migration
-- est OMIS ici, comme dans toutes les migrations précédentes depuis la
-- consolidation Phase 2 (merge_speaker_media_into_assets) : MySQL ne
-- renomme pas les noms de contrainte/index lors d'un RENAME TABLE, Prisma
-- le redétecte donc à chaque diff sans qu'il y ait de changement réel.

-- 1) Renommage d'une valeur de l'enum `status` (INTERVIEWED -> INTERVIEW_DONE)
--    + nouvelles colonnes de traitement interne. Sûr sans backfill : 0 ligne
--    dans `roster_applications` en production au moment de cette migration
--    (vérifié avant d'écrire ce fichier, même pratique que pour la 3b).
ALTER TABLE `roster_applications`
  MODIFY COLUMN `status` ENUM(
    'NEW', 'UNDER_REVIEW', 'INFO_REQUESTED', 'INTERVIEW_TO_SCHEDULE',
    'INTERVIEW_DONE', 'APPROVED', 'REJECTED', 'CONVERTED', 'ARCHIVED'
  ) NOT NULL DEFAULT 'NEW';

-- 2) `internalScore`/`internalComment`/`evaluation` (Phase 1, grille libre en
--    JSON) supprimés : remplacés par `roster_application_evaluations`, une
--    ligne PAR évaluateur avec des critères typés (voir §2 du prompt).
ALTER TABLE `roster_applications`
  DROP COLUMN `internal_score`,
  DROP COLUMN `internal_comment`,
  DROP COLUMN `evaluation`;

-- 3) Nouvelles colonnes de traitement interne + conversion (§1/§4).
ALTER TABLE `roster_applications`
  ADD COLUMN `status_changed_at` DATETIME(3) NULL,
  ADD COLUMN `interview_scheduled_at` DATETIME(3) NULL,
  ADD COLUMN `interview_notes` TEXT NULL,
  ADD COLUMN `rejection_reason` TEXT NULL,
  ADD COLUMN `converted_user_id` INTEGER NULL,
  ADD COLUMN `converted_at` DATETIME(3) NULL;

-- Unique-nullable : porte, au niveau BASE, la garantie d'idempotence de la
-- conversion (§4.2) — même pattern que `converted_speaker_id` déjà en place,
-- `SpeakerRevision.activeGuard` et `Contact.normalizedEmail`.
CREATE UNIQUE INDEX `roster_applications_converted_user_id_key` ON `roster_applications`(`converted_user_id`);

-- 4) Conditions de collaboration, acceptées à l'acceptation de l'invitation
--    (§4.4) — en même temps que la définition du mot de passe.
ALTER TABLE `users`
  ADD COLUMN `accepted_terms_at` DATETIME(3) NULL,
  ADD COLUMN `accepted_terms_version` VARCHAR(60) NULL;

-- 5) Évaluations internes — une par évaluateur (§2, §5.3 du cahier des charges).
CREATE TABLE `roster_application_evaluations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `application_id` INTEGER NOT NULL,
    `evaluator_id` INTEGER NOT NULL,
    `expertise_level` INTEGER NOT NULL,
    `professional_credibility` INTEGER NOT NULL,
    `stage_experience` INTEGER NOT NULL,
    `speaking_quality` INTEGER NOT NULL,
    `international_relevance` INTEGER NOT NULL,
    `language_proficiency` INTEGER NOT NULL,
    `media_quality` INTEGER NOT NULL,
    `pillar_fit` INTEGER NOT NULL,
    `commercial_potential` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `roster_application_evaluations_application_id_idx`(`application_id`),
    UNIQUE INDEX `roster_application_evaluations_application_id_evaluator_id_key`(`application_id`, `evaluator_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6) Pièces jointes — réutilise intégralement la brique de stockage privé de
--    la Phase 2c, même modèle que `booking_request_attachments` (§3b/§5).
CREATE TABLE `roster_application_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `application_id` INTEGER NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(150) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `uploaded_by_id` INTEGER NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `roster_application_attachments_application_id_idx`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7) Token d'invitation (§4.4) — distinct de email_verification_tokens et
--    password_reset_tokens (durée de vie longue, usage unique).
CREATE TABLE `invitation_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invitation_tokens_token_key`(`token`),
    INDEX `invitation_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8) Clés étrangères.
ALTER TABLE `roster_applications`
  ADD CONSTRAINT `roster_applications_converted_user_id_fkey`
  FOREIGN KEY (`converted_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `roster_application_evaluations`
  ADD CONSTRAINT `roster_application_evaluations_application_id_fkey`
  FOREIGN KEY (`application_id`) REFERENCES `roster_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `roster_application_evaluations`
  ADD CONSTRAINT `roster_application_evaluations_evaluator_id_fkey`
  FOREIGN KEY (`evaluator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `roster_application_attachments`
  ADD CONSTRAINT `roster_application_attachments_application_id_fkey`
  FOREIGN KEY (`application_id`) REFERENCES `roster_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `roster_application_attachments`
  ADD CONSTRAINT `roster_application_attachments_uploaded_by_id_fkey`
  FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `invitation_tokens`
  ADD CONSTRAINT `invitation_tokens_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
