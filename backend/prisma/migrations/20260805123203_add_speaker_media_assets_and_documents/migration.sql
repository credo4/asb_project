-- CreateTable
CREATE TABLE `speaker_media_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `type` ENUM('PHOTO', 'VIDEO', 'PRESS_KIT') NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `title` VARCHAR(250) NULL,
    `caption` TEXT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `reviewed_at` DATETIME(3) NULL,
    `reviewed_by_id` INTEGER NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `speaker_media_assets_speaker_id_idx`(`speaker_id`),
    INDEX `speaker_media_assets_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `type` ENUM('CV', 'CERTIFICATE', 'OTHER') NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `speaker_documents_speaker_id_idx`(`speaker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `speaker_media_assets` ADD CONSTRAINT `speaker_media_assets_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_media_assets` ADD CONSTRAINT `speaker_media_assets_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_documents` ADD CONSTRAINT `speaker_documents_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

