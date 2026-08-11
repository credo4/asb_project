-- Phase 3, étape 3a — clients/organisations + traçage analytics.
-- Purement additif : 3 nouvelles tables + 2 colonnes nullables sur
-- booking_requests, aucune donnée existante touchée, aucun backfill (voir
-- `npm run backfill:contacts`, exécuté séparément à la demande).
--
-- Note : `prisma migrate diff` a aussi fait remonter des instructions sans
-- rapport avec cette étape (renommage de contraintes/index sur `speaker_media`,
-- résidu cosmétique de la migration `rename_speaker_media_assets_to_speaker_media` —
-- `RENAME TABLE` ne renomme pas les noms de contraintes/index eux-mêmes).
-- Volontairement OMISES ici, comme dans `add_speaker_availability`.

-- AlterTable
ALTER TABLE `booking_requests` ADD COLUMN `contact_id` INTEGER NULL,
    ADD COLUMN `organization_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `organizations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(250) NOT NULL,
    `sector` VARCHAR(120) NULL,
    `country_id` INTEGER NULL,
    `website` VARCHAR(500) NULL,
    `internal_notes` TEXT NULL,
    `assigned_admin_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `organizations_country_id_idx`(`country_id`),
    INDEX `organizations_assigned_admin_id_idx`(`assigned_admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(120) NOT NULL,
    `last_name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `normalized_email` VARCHAR(191) NULL,
    `phone` VARCHAR(50) NULL,
    `job_title` VARCHAR(200) NULL,
    `organization_id` INTEGER NULL,
    `country_id` INTEGER NULL,
    `internal_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `contacts_normalized_email_key`(`normalized_email`),
    INDEX `contacts_organization_id_idx`(`organization_id`),
    INDEX `contacts_country_id_idx`(`country_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analytics_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('PROFILE_VIEW', 'SEARCH', 'CHECK_AVAILABILITY_CLICK', 'CURATED_LIST_VIEW', 'TOPIC_VIEW') NOT NULL,
    `speaker_id` INTEGER NULL,
    `payload` JSON NULL,
    `visitor_hash` VARCHAR(64) NOT NULL,
    `is_bot` BOOLEAN NOT NULL DEFAULT false,
    `user_agent` VARCHAR(255) NULL,
    `referrer` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `analytics_events_type_idx`(`type`),
    INDEX `analytics_events_speaker_id_idx`(`speaker_id`),
    INDEX `analytics_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `booking_requests_contact_id_idx` ON `booking_requests`(`contact_id`);

-- CreateIndex
CREATE INDEX `booking_requests_organization_id_idx` ON `booking_requests`(`organization_id`);

-- AddForeignKey
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_assigned_admin_id_fkey` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
