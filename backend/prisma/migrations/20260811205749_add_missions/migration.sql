-- Phase 3, étape 3e — missions (dernière étape de la Phase 3). Quatre
-- tables : missions, mission_checklist_items, mission_documents,
-- mission_messages. Aucun module financier (facturation, paiements en
-- ligne — v2) : on stocke montants et statuts, on ne facture rien.
--
-- Le bloc "speaker_media" (ALTER COLUMN updated_at DROP DEFAULT) est OMIS,
-- comme dans toutes les migrations précédentes — artefact cosmétique sans
-- rapport, sans perte de données.

CREATE TABLE `missions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(30) NOT NULL,
    `booking_request_id` INTEGER NOT NULL,
    `speaker_id` INTEGER NOT NULL,
    `organization_id` INTEGER NULL,
    `contact_id` INTEGER NULL,
    `service_type` ENUM('CONFERENCE', 'MASTERCLASS', 'WEBINAR', 'ADVISORY', 'ONE_TO_ONE') NOT NULL,
    `event_date` DATETIME(3) NOT NULL,
    `start_time` VARCHAR(10) NULL,
    `end_time` VARCHAR(10) NULL,
    `timezone` VARCHAR(60) NULL,
    `location_country_id` INTEGER NULL,
    `address` TEXT NULL,
    `is_virtual` BOOLEAN NOT NULL DEFAULT false,
    `virtual_link` VARCHAR(500) NULL,
    `on_site_contact_name` VARCHAR(200) NULL,
    `on_site_contact_phone` VARCHAR(50) NULL,
    `duration_minutes` INTEGER NULL,
    `topic` TEXT NOT NULL,
    `language` VARCHAR(80) NULL,
    `format` VARCHAR(120) NULL,
    `participant_count` INTEGER NULL,
    `client_amount` DECIMAL(12, 2) NULL,
    `speaker_amount` DECIMAL(12, 2) NULL,
    `agency_commission` DECIMAL(12, 2) NULL,
    `expenses` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `status` ENUM('PREPARATION', 'AVAILABILITY_CONFIRMED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'CONTRACT_SENT', 'CONTRACT_SIGNED', 'DEPOSIT_EXPECTED', 'DEPOSIT_RECEIVED', 'LOGISTICS_IN_PROGRESS', 'CONFIRMED', 'DELIVERED', 'SPEAKER_PAYMENT_PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PREPARATION',
    `contract_status` ENUM('PENDING', 'SENT', 'SIGNED') NOT NULL DEFAULT 'PENDING',
    `payment_status` ENUM('PENDING', 'DEPOSIT_RECEIVED', 'FULLY_PAID') NOT NULL DEFAULT 'PENDING',
    `logistics_status` ENUM('PENDING', 'IN_PROGRESS', 'READY') NOT NULL DEFAULT 'PENDING',
    `internal_notes` TEXT NULL,
    `cancellation_reason` TEXT NULL,
    `accepted_at` DATETIME(3) NULL,
    `accepted_by_id` INTEGER NULL,
    `brief_acknowledged_at` DATETIME(3) NULL,
    `active_guard` VARCHAR(40) NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `missions_reference_key`(`reference`),
    UNIQUE INDEX `missions_active_guard_key`(`active_guard`),
    INDEX `missions_booking_request_id_idx`(`booking_request_id`),
    INDEX `missions_speaker_id_idx`(`speaker_id`),
    INDEX `missions_organization_id_idx`(`organization_id`),
    INDEX `missions_status_idx`(`status`),
    INDEX `missions_event_date_idx`(`event_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `mission_checklist_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mission_id` INTEGER NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `label` VARCHAR(250) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `is_done` BOOLEAN NOT NULL DEFAULT false,
    `done_by_id` INTEGER NULL,
    `done_at` DATETIME(3) NULL,
    `notes` TEXT NULL,

    INDEX `mission_checklist_items_mission_id_idx`(`mission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `mission_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mission_id` INTEGER NOT NULL,
    `type` ENUM('BRIEF', 'CONTRACT', 'SIGNED_CONTRACT', 'PRESENTATION', 'INVOICE', 'TRAVEL_INFO', 'OTHER') NOT NULL,
    `uploaded_by_id` INTEGER NULL,
    `uploaded_by_role` ENUM('SUPER_ADMIN', 'ADMIN', 'SPEAKER') NOT NULL,
    `is_shared_with_speaker` BOOLEAN NOT NULL DEFAULT false,
    `storage_key` VARCHAR(500) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(150) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `mission_documents_mission_id_idx`(`mission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `mission_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mission_id` INTEGER NOT NULL,
    `author_id` INTEGER NULL,
    `author_role` ENUM('SUPER_ADMIN', 'ADMIN', 'SPEAKER') NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mission_messages_mission_id_idx`(`mission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `missions`
  ADD CONSTRAINT `missions_booking_request_id_fkey`
  FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `missions`
  ADD CONSTRAINT `missions_speaker_id_fkey`
  FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `missions`
  ADD CONSTRAINT `missions_organization_id_fkey`
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `missions`
  ADD CONSTRAINT `missions_contact_id_fkey`
  FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `missions`
  ADD CONSTRAINT `missions_location_country_id_fkey`
  FOREIGN KEY (`location_country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `missions`
  ADD CONSTRAINT `missions_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `missions`
  ADD CONSTRAINT `missions_accepted_by_id_fkey`
  FOREIGN KEY (`accepted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `mission_checklist_items`
  ADD CONSTRAINT `mission_checklist_items_mission_id_fkey`
  FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `mission_checklist_items`
  ADD CONSTRAINT `mission_checklist_items_done_by_id_fkey`
  FOREIGN KEY (`done_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `mission_documents`
  ADD CONSTRAINT `mission_documents_mission_id_fkey`
  FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `mission_documents`
  ADD CONSTRAINT `mission_documents_uploaded_by_id_fkey`
  FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `mission_messages`
  ADD CONSTRAINT `mission_messages_mission_id_fkey`
  FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `mission_messages`
  ADD CONSTRAINT `mission_messages_author_id_fkey`
  FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
