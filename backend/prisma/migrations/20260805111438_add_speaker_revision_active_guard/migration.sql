-- AlterTable
ALTER TABLE `speaker_revisions` ADD COLUMN `active_guard` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `speaker_revisions_active_guard_key` ON `speaker_revisions`(`active_guard`);
