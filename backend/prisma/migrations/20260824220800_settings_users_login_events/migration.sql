-- AlterTable
ALTER TABLE `users` ADD COLUMN `preferences` JSON NULL;

-- CreateTable
CREATE TABLE `login_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `email_attempted` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `failure_reason` VARCHAR(120) NULL,
    `ip_hash` VARCHAR(64) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_events_user_id_idx`(`user_id`),
    INDEX `login_events_success_idx`(`success`),
    INDEX `login_events_created_at_idx`(`created_at`),
    INDEX `login_events_email_attempted_idx`(`email_attempted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agency_name` VARCHAR(200) NULL,
    `team_email` VARCHAR(191) NULL,
    `response_sla_business_days` INTEGER NULL,
    `default_currency` VARCHAR(3) NULL,
    `collaboration_terms_version` VARCHAR(60) NULL,
    `updated_by_id` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `login_events` ADD CONSTRAINT `login_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_settings` ADD CONSTRAINT `app_settings_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
