-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'SPEAKER') NOT NULL DEFAULT 'ADMIN',
    `status` ENUM('ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `first_name` VARCHAR(120) NULL,
    `last_name` VARCHAR(120) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `two_factor_secret` VARCHAR(255) NULL,
    `two_factor_enabled` BOOLEAN NOT NULL DEFAULT false,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_verification_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_verification_tokens_token_key`(`token`),
    INDEX `email_verification_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pillars` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `color` VARCHAR(20) NULL,
    `image_url` VARCHAR(500) NULL,
    `intro` TEXT NULL,
    `problem_statement` TEXT NULL,
    `value_proposition` TEXT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PUBLISHED', 'HIDDEN') NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pillars_slug_key`(`slug`),
    INDEX `pillars_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `themes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pillar_id` INTEGER NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `themes_pillar_id_idx`(`pillar_id`),
    UNIQUE INDEX `themes_pillar_id_slug_key`(`pillar_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `formats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `formats_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `languages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(10) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `languages_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `countries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `iso2` VARCHAR(2) NOT NULL,
    `iso3` VARCHAR(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `countries_iso2_key`(`iso2`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speakers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `civility` VARCHAR(20) NULL,
    `first_name` VARCHAR(120) NOT NULL,
    `last_name` VARCHAR(120) NOT NULL,
    `public_name` VARCHAR(200) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(50) NULL,
    `country_id` INTEGER NULL,
    `nationality_country_id` INTEGER NULL,
    `city` VARCHAR(120) NULL,
    `timezone` VARCHAR(60) NULL,
    `profile_photo_url` VARCHAR(500) NULL,
    `cover_photo_url` VARCHAR(500) NULL,
    `professional_title` VARCHAR(200) NULL,
    `current_organization` VARCHAR(200) NULL,
    `current_position` VARCHAR(200) NULL,
    `website_url` VARCHAR(500) NULL,
    `linkedin_url` VARCHAR(500) NULL,
    `social_links` JSON NULL,
    `short_bio` TEXT NULL,
    `full_bio` TEXT NULL,
    `quote` TEXT NULL,
    `expertise_summary` TEXT NULL,
    `value_proposition` TEXT NULL,
    `career_path` TEXT NULL,
    `key_achievements` TEXT NULL,
    `awards` TEXT NULL,
    `fee_tier_public` ENUM('TIER_1', 'TIER_2', 'TIER_3') NULL,
    `status` ENUM('DRAFT', 'INCOMPLETE', 'PENDING_VALIDATION', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED', 'UNPUBLISHED', 'SUSPENDED', 'ARCHIVED', 'APPLICATION_REJECTED') NOT NULL DEFAULT 'DRAFT',
    `slug` VARCHAR(200) NULL,
    `is_visible` BOOLEAN NOT NULL DEFAULT false,
    `is_featured_home` BOOLEAN NOT NULL DEFAULT false,
    `is_top_requested` BOOLEAN NOT NULL DEFAULT false,
    `show_budget` BOOLEAN NOT NULL DEFAULT false,
    `show_location` BOOLEAN NOT NULL DEFAULT true,
    `allow_indexing` BOOLEAN NOT NULL DEFAULT true,
    `completion_score` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `speakers_user_id_key`(`user_id`),
    UNIQUE INDEX `speakers_slug_key`(`slug`),
    INDEX `speakers_status_idx`(`status`),
    INDEX `speakers_is_top_requested_idx`(`is_top_requested`),
    INDEX `speakers_is_featured_home_idx`(`is_featured_home`),
    INDEX `speakers_is_visible_idx`(`is_visible`),
    INDEX `speakers_country_id_idx`(`country_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_pillars` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `pillar_id` INTEGER NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `speaker_pillars_pillar_id_idx`(`pillar_id`),
    UNIQUE INDEX `speaker_pillars_speaker_id_pillar_id_key`(`speaker_id`, `pillar_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_themes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `theme_id` INTEGER NOT NULL,

    INDEX `speaker_themes_theme_id_idx`(`theme_id`),
    UNIQUE INDEX `speaker_themes_speaker_id_theme_id_key`(`speaker_id`, `theme_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_keywords` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `keyword` VARCHAR(120) NOT NULL,

    INDEX `speaker_keywords_keyword_idx`(`keyword`),
    UNIQUE INDEX `speaker_keywords_speaker_id_keyword_key`(`speaker_id`, `keyword`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_formats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `format_id` INTEGER NOT NULL,

    INDEX `speaker_formats_format_id_idx`(`format_id`),
    UNIQUE INDEX `speaker_formats_speaker_id_format_id_key`(`speaker_id`, `format_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_languages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `language_id` INTEGER NOT NULL,
    `proficiency` ENUM('NATIVE', 'FLUENT', 'PROFESSIONAL', 'INTERMEDIATE') NOT NULL DEFAULT 'FLUENT',
    `can_present` BOOLEAN NOT NULL DEFAULT true,
    `can_qa` BOOLEAN NOT NULL DEFAULT true,
    `can_moderate` BOOLEAN NOT NULL DEFAULT false,

    INDEX `speaker_languages_language_id_idx`(`language_id`),
    UNIQUE INDEX `speaker_languages_speaker_id_language_id_key`(`speaker_id`, `language_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_pricing` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `min_fee` DECIMAL(12, 2) NULL,
    `recommended_fee` DECIMAL(12, 2) NULL,
    `fee_keynote` DECIMAL(12, 2) NULL,
    `fee_panel` DECIMAL(12, 2) NULL,
    `fee_webinar` DECIMAL(12, 2) NULL,
    `fee_masterclass` DECIMAL(12, 2) NULL,
    `fee_advisory` DECIMAL(12, 2) NULL,
    `fee_one_to_one` DECIMAL(12, 2) NULL,
    `travel_fees` TEXT NULL,
    `negotiation_terms` TEXT NULL,
    `agency_commission` DECIMAL(5, 2) NULL,
    `internal_notes` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `speaker_pricing_speaker_id_key`(`speaker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signature_engagements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `event_name` VARCHAR(250) NOT NULL,
    `organization` VARCHAR(200) NULL,
    `country_id` INTEGER NULL,
    `event_date` DATE NULL,
    `date_label` VARCHAR(40) NULL,
    `role` VARCHAR(160) NULL,
    `topic` VARCHAR(250) NULL,
    `description` TEXT NULL,
    `photo_url` VARCHAR(500) NULL,
    `video_url` VARCHAR(500) NULL,
    `external_url` VARCHAR(500) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `signature_engagements_speaker_id_idx`(`speaker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speaker_media` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speaker_id` INTEGER NOT NULL,
    `type` ENUM('GALLERY_PHOTO', 'VIDEO', 'DEMO_REEL', 'KEYNOTE_EXCERPT', 'PODCAST', 'INTERVIEW', 'PRESS_KIT', 'PDF_DOCUMENT', 'PRESENTATION', 'DOWNLOADABLE_BIO', 'LOGO') NOT NULL,
    `title` VARCHAR(250) NULL,
    `url` VARCHAR(500) NULL,
    `file_path` VARCHAR(500) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `speaker_media_speaker_id_idx`(`speaker_id`),
    INDEX `speaker_media_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(30) NOT NULL,
    `service_type` ENUM('CONFERENCE', 'MASTERCLASS', 'WEBINAR', 'ADVISORY', 'ONE_TO_ONE') NOT NULL,
    `status` ENUM('NEW', 'TO_QUALIFY', 'UNDER_ANALYSIS', 'SELECTING_SPEAKERS', 'PROPOSAL_SENT', 'AWAITING_CLIENT', 'AWAITING_SPEAKER', 'NEGOTIATION', 'CONFIRMED', 'CONTRACT_IN_PREPARATION', 'CANCELLED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `full_name` VARCHAR(200) NOT NULL,
    `organization` VARCHAR(200) NULL,
    `job_title` VARCHAR(200) NULL,
    `work_email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `website_or_linkedin` VARCHAR(500) NULL,
    `event_name` VARCHAR(250) NULL,
    `event_date` DATETIME(3) NULL,
    `event_location` VARCHAR(250) NULL,
    `event_format` VARCHAR(120) NULL,
    `audience_size` VARCHAR(60) NULL,
    `session_length` VARCHAR(60) NULL,
    `language` VARCHAR(80) NULL,
    `primary_topics` TEXT NULL,
    `goals` TEXT NULL,
    `speaker_preferences` TEXT NULL,
    `estimated_budget` VARCHAR(120) NULL,
    `additional_comments` TEXT NULL,
    `visit_purpose` ENUM('ASPIRING_SPEAKER', 'PROSPECTIVE_CLIENT', 'OTHER') NULL,
    `key_questions` TEXT NULL,
    `preferred_time` VARCHAR(120) NULL,
    `metadata` JSON NULL,
    `requested_speaker_id` INTEGER NULL,
    `assigned_admin_id` INTEGER NULL,
    `internal_notes` TEXT NULL,
    `source` VARCHAR(120) NULL,
    `gdpr_consent` BOOLEAN NOT NULL DEFAULT false,
    `response_due_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `booking_requests_reference_key`(`reference`),
    INDEX `booking_requests_service_type_idx`(`service_type`),
    INDEX `booking_requests_status_idx`(`status`),
    INDEX `booking_requests_priority_idx`(`priority`),
    INDEX `booking_requests_assigned_admin_id_idx`(`assigned_admin_id`),
    INDEX `booking_requests_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roster_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(30) NOT NULL,
    `full_name` VARCHAR(200) NOT NULL,
    `job_title` VARCHAR(200) NULL,
    `organization` VARCHAR(200) NULL,
    `country` VARCHAR(120) NULL,
    `work_email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `linkedin_url` VARCHAR(500) NULL,
    `expertise_area` VARCHAR(250) NULL,
    `key_topics` TEXT NULL,
    `message` TEXT NULL,
    `status` ENUM('NEW', 'UNDER_REVIEW', 'INFO_REQUESTED', 'INTERVIEW_TO_SCHEDULE', 'INTERVIEWED', 'APPROVED', 'REJECTED', 'CONVERTED', 'ARCHIVED') NOT NULL DEFAULT 'NEW',
    `assigned_admin_id` INTEGER NULL,
    `internal_score` INTEGER NULL,
    `internal_comment` TEXT NULL,
    `evaluation` JSON NULL,
    `gdpr_consent` BOOLEAN NOT NULL DEFAULT false,
    `converted_speaker_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roster_applications_reference_key`(`reference`),
    UNIQUE INDEX `roster_applications_converted_speaker_id_key`(`converted_speaker_id`),
    INDEX `roster_applications_status_idx`(`status`),
    INDEX `roster_applications_assigned_admin_id_idx`(`assigned_admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actor_id` INTEGER NULL,
    `action` VARCHAR(120) NOT NULL,
    `entity_type` VARCHAR(80) NULL,
    `entity_id` INTEGER NULL,
    `old_value` JSON NULL,
    `new_value` JSON NULL,
    `ip_address` VARCHAR(60) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_actor_id_idx`(`actor_id`),
    INDEX `activity_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `activity_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `email_verification_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `themes` ADD CONSTRAINT `themes_pillar_id_fkey` FOREIGN KEY (`pillar_id`) REFERENCES `pillars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speakers` ADD CONSTRAINT `speakers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speakers` ADD CONSTRAINT `speakers_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speakers` ADD CONSTRAINT `speakers_nationality_country_id_fkey` FOREIGN KEY (`nationality_country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_pillars` ADD CONSTRAINT `speaker_pillars_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_pillars` ADD CONSTRAINT `speaker_pillars_pillar_id_fkey` FOREIGN KEY (`pillar_id`) REFERENCES `pillars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_themes` ADD CONSTRAINT `speaker_themes_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_themes` ADD CONSTRAINT `speaker_themes_theme_id_fkey` FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_keywords` ADD CONSTRAINT `speaker_keywords_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_formats` ADD CONSTRAINT `speaker_formats_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_formats` ADD CONSTRAINT `speaker_formats_format_id_fkey` FOREIGN KEY (`format_id`) REFERENCES `formats`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_languages` ADD CONSTRAINT `speaker_languages_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_languages` ADD CONSTRAINT `speaker_languages_language_id_fkey` FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_pricing` ADD CONSTRAINT `speaker_pricing_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `signature_engagements` ADD CONSTRAINT `signature_engagements_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `signature_engagements` ADD CONSTRAINT `signature_engagements_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_media` ADD CONSTRAINT `speaker_media_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_requested_speaker_id_fkey` FOREIGN KEY (`requested_speaker_id`) REFERENCES `speakers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_assigned_admin_id_fkey` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roster_applications` ADD CONSTRAINT `roster_applications_assigned_admin_id_fkey` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roster_applications` ADD CONSTRAINT `roster_applications_converted_speaker_id_fkey` FOREIGN KEY (`converted_speaker_id`) REFERENCES `speakers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
