-- Phase 3, étape 3b — traitement des demandes clients (cf. cahier des
-- charges §6). Écrite à la main (MySQL local indisponible au moment de
-- cette étape) en suivant fidèlement les conventions DDL des migrations
-- précédentes de ce projet. Sûre sans backfill : aucune ligne dans
-- `booking_requests` en production au moment de cette migration (vérifié
-- avant d'écrire ce fichier).

-- 1) Renommage de 2 valeurs de l'enum `status` (NEGOTIATION -> NEGOTIATING,
--    REJECTED -> DECLINED) : cf. cahier des charges §6.3, 13 statuts.
ALTER TABLE `booking_requests`
  MODIFY COLUMN `status` ENUM(
    'NEW', 'TO_QUALIFY', 'UNDER_ANALYSIS', 'SELECTING_SPEAKERS',
    'PROPOSAL_SENT', 'AWAITING_CLIENT', 'AWAITING_SPEAKER', 'NEGOTIATING',
    'CONFIRMED', 'CONTRACT_IN_PREPARATION', 'CANCELLED', 'DECLINED', 'CLOSED'
  ) NOT NULL DEFAULT 'NEW';

-- 2) `source` : ancien champ texte libre (une seule valeur utilisée jusqu'ici,
--    'public_website') remplacé par un enum fermé. Sans backfill nécessaire :
--    aucune ligne en prod à cette date.
ALTER TABLE `booking_requests`
  MODIFY COLUMN `source` ENUM('PUBLIC_FORM', 'MANUAL_ENTRY', 'REFERRAL', 'OTHER')
  NOT NULL DEFAULT 'PUBLIC_FORM';

-- 3) `internalNotes` (Phase 1, champ texte unique) supprimé : deux admins qui
--    écrivaient en même temps s'écrasaient mutuellement — remplacé par
--    `booking_request_notes`, en ajout seul (voir §2.3 du prompt).
ALTER TABLE `booking_requests`
  DROP COLUMN `internal_notes`;

-- 4) Nouvelles colonnes — suivi du délai de réponse + consentement (transition
--    douce, voir CreateBookingRequestDto/REQUIRE_CONSENT).
ALTER TABLE `booking_requests`
  ADD COLUMN `first_responded_at` DATETIME(3) NULL,
  ADD COLUMN `consent_given_at` DATETIME(3) NULL,
  ADD COLUMN `consent_version` VARCHAR(60) NULL;

-- 5) Notes internes — ajout seul (§2.3).
CREATE TABLE `booking_request_notes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NOT NULL,
    `author_id` INTEGER NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `booking_request_notes_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6) Pièces jointes — réutilise la brique de stockage privé de la Phase 2c
--    (§2.4). Jamais de route publique, jamais accessible à un rôle SPEAKER.
CREATE TABLE `booking_request_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(150) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `uploaded_by_id` INTEGER NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `booking_request_attachments_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7) Rappels — une tâche planifiée horaire (@nestjs/schedule) envoie par
--    email les rappels échus (§2.6).
CREATE TABLE `reminders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NOT NULL,
    `due_at` DATETIME(3) NOT NULL,
    `assigned_to_id` INTEGER NULL,
    `message` TEXT NOT NULL,
    `done_at` DATETIME(3) NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reminders_request_id_idx`(`request_id`),
    INDEX `reminders_due_at_idx`(`due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8) Clés étrangères.
ALTER TABLE `booking_request_notes`
  ADD CONSTRAINT `booking_request_notes_request_id_fkey`
  FOREIGN KEY (`request_id`) REFERENCES `booking_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `booking_request_notes`
  ADD CONSTRAINT `booking_request_notes_author_id_fkey`
  FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `booking_request_attachments`
  ADD CONSTRAINT `booking_request_attachments_request_id_fkey`
  FOREIGN KEY (`request_id`) REFERENCES `booking_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `booking_request_attachments`
  ADD CONSTRAINT `booking_request_attachments_uploaded_by_id_fkey`
  FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `reminders`
  ADD CONSTRAINT `reminders_request_id_fkey`
  FOREIGN KEY (`request_id`) REFERENCES `booking_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `reminders`
  ADD CONSTRAINT `reminders_assigned_to_id_fkey`
  FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `reminders`
  ADD CONSTRAINT `reminders_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
