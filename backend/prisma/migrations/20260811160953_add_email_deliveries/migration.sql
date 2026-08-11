-- Consolidation avant la suite de la Phase 3, Partie E — journal d'envoi
-- des emails. Un échec SMTP était jusqu'ici capturé, logué (Logger), et
-- invisible partout ailleurs : en production, une panne d'envoi passerait
-- inaperçue des semaines.
--
-- Le bloc "speaker_media" (ALTER COLUMN updated_at DROP DEFAULT) est OMIS,
-- comme dans toutes les migrations précédentes — artefact cosmétique sans
-- rapport, sans perte de données.

CREATE TABLE `email_deliveries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `template` VARCHAR(80) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `error_message` TEXT NULL,
    `attempted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sent_at` DATETIME(3) NULL,
    `related_entity_type` VARCHAR(80) NULL,
    `related_entity_id` INTEGER NULL,

    INDEX `email_deliveries_status_idx`(`status`),
    INDEX `email_deliveries_attempted_at_idx`(`attempted_at`),
    INDEX `email_deliveries_related_entity_type_related_entity_id_idx`(`related_entity_type`, `related_entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
