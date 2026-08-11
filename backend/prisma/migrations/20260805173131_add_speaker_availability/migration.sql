-- Phase 2, étape 2d — disponibilités du speaker (cf. cahier des charges §17).
-- Purement additif : 3 nouvelles tables, aucune donnée existante touchée.
--
-- Note : `prisma migrate diff` a aussi fait remonter des instructions sans
-- rapport avec cette étape (renommage de contraintes/index sur `speaker_media`,
-- résidu cosmétique de la migration `rename_speaker_media_assets_to_speaker_media` —
-- `RENAME TABLE` ne renomme pas les noms de contraintes/index eux-mêmes).
-- Volontairement OMISES ici : cette migration ne touche qu'à ce qui concerne
-- les disponibilités.

-- CreateTable
CREATE TABLE `speaker_availability_periods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `type` ENUM('AVAILABLE', 'UNAVAILABLE') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `speaker_availability_periods_speaker_id_idx`(`speaker_id`),
    INDEX `speaker_availability_periods_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_travel_preferences` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `travel_scope` ENUM('WORLDWIDE', 'SELECTED_COUNTRIES', 'NO_TRAVEL') NOT NULL DEFAULT 'WORLDWIDE',
    `available_for_virtual` BOOLEAN NOT NULL DEFAULT true,
    `minimum_notice_days` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `speaker_travel_preferences_speaker_id_key`(`speaker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_travel_preference_countries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `travel_preference_id` INTEGER NOT NULL,
    `country_id` INTEGER NOT NULL,

    INDEX `speaker_travel_preference_countries_country_id_idx`(`country_id`),
    UNIQUE INDEX `speaker_travel_preference_countries_travel_preference_id_cou_key`(`travel_preference_id`, `country_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `speaker_availability_periods` ADD CONSTRAINT `speaker_availability_periods_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_travel_preferences` ADD CONSTRAINT `speaker_travel_preferences_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_travel_preference_countries` ADD CONSTRAINT `speaker_travel_preference_countries_travel_preference_id_fkey` FOREIGN KEY (`travel_preference_id`) REFERENCES `speaker_travel_preferences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_travel_preference_countries` ADD CONSTRAINT `speaker_travel_preference_countries_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
