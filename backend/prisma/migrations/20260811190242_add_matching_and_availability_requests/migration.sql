-- Phase 3, étape 3d — matching et demandes de disponibilité. Deux tables :
-- booking_request_speakers (sélection de candidats pour une demande) et
-- availability_requests (sollicitations de disponibilité envoyées, avec
-- copie du briefing en colonnes propres — voir CLAUDE.md pour la
-- frontière admin <-> speaker).
--
-- Le bloc "speaker_media" (ALTER COLUMN updated_at DROP DEFAULT) est OMIS,
-- comme dans toutes les migrations précédentes — artefact cosmétique sans
-- rapport, sans perte de données.

CREATE TABLE `booking_request_speakers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NOT NULL,
    `speaker_id` INTEGER NOT NULL,
    `added_by_id` INTEGER NULL,
    `added_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('SHORTLISTED', 'AVAILABILITY_REQUESTED', 'SPEAKER_AVAILABLE', 'SPEAKER_AVAILABLE_WITH_CONDITIONS', 'SPEAKER_UNAVAILABLE', 'SPEAKER_NEEDS_INFO', 'PROPOSED_TO_CLIENT', 'CLIENT_DECLINED', 'SELECTED', 'WITHDRAWN') NOT NULL DEFAULT 'SHORTLISTED',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `internal_notes` TEXT NULL,
    `proposed_to_client_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `booking_request_speakers_request_id_idx`(`request_id`),
    INDEX `booking_request_speakers_speaker_id_idx`(`speaker_id`),
    INDEX `booking_request_speakers_status_idx`(`status`),
    UNIQUE INDEX `booking_request_speakers_request_id_speaker_id_key`(`request_id`, `speaker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `availability_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `booking_request_id` INTEGER NOT NULL,
    `speaker_id` INTEGER NOT NULL,
    `sent_by_id` INTEGER NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respond_due_at` DATETIME(3) NOT NULL,
    `status` ENUM('SENT', 'RESPONDED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'SENT',
    `event_type` VARCHAR(120) NOT NULL,
    `event_date` DATETIME(3) NOT NULL,
    `event_end_date` DATETIME(3) NULL,
    `location_country_id` INTEGER NULL,
    `is_virtual` BOOLEAN NOT NULL DEFAULT false,
    `duration_minutes` INTEGER NULL,
    `topic` TEXT NOT NULL,
    `audience_description` TEXT NULL,
    `audience_size` VARCHAR(60) NULL,
    `language` VARCHAR(80) NULL,
    `proposed_fee_amount` DECIMAL(12, 2) NULL,
    `proposed_fee_currency` VARCHAR(3) NULL,
    `travel_conditions` TEXT NULL,
    `additional_notes` TEXT NULL,
    `response_status` ENUM('AVAILABLE_INTERESTED', 'AVAILABLE_WITH_CONDITIONS', 'UNAVAILABLE', 'NEEDS_INFO') NULL,
    `responded_at` DATETIME(3) NULL,
    `speaker_private_comment` TEXT NULL,
    `active_guard` VARCHAR(40) NULL,

    UNIQUE INDEX `availability_requests_active_guard_key`(`active_guard`),
    INDEX `availability_requests_booking_request_id_idx`(`booking_request_id`),
    INDEX `availability_requests_speaker_id_idx`(`speaker_id`),
    INDEX `availability_requests_status_idx`(`status`),
    INDEX `availability_requests_respond_due_at_idx`(`respond_due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `booking_request_speakers`
  ADD CONSTRAINT `booking_request_speakers_request_id_fkey`
  FOREIGN KEY (`request_id`) REFERENCES `booking_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `booking_request_speakers`
  ADD CONSTRAINT `booking_request_speakers_speaker_id_fkey`
  FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `booking_request_speakers`
  ADD CONSTRAINT `booking_request_speakers_added_by_id_fkey`
  FOREIGN KEY (`added_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `availability_requests`
  ADD CONSTRAINT `availability_requests_booking_request_id_fkey`
  FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `availability_requests`
  ADD CONSTRAINT `availability_requests_speaker_id_fkey`
  FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `availability_requests`
  ADD CONSTRAINT `availability_requests_sent_by_id_fkey`
  FOREIGN KEY (`sent_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `availability_requests`
  ADD CONSTRAINT `availability_requests_location_country_id_fkey`
  FOREIGN KEY (`location_country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
