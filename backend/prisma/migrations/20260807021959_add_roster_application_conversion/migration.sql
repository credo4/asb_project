-- Nettoyage cosmétique, sans rapport avec la Phase 3c : renomme les
-- contraintes/index de `speaker_media` qui portaient encore l'ancien nom
-- `speaker_media_assets_*` depuis la consolidation Phase 2 (RENAME TABLE ne
-- renomme pas les noms de contrainte/index sous MySQL — la même noise que
-- toutes les migrations précédentes depuis lors omettaient volontairement).
-- Générée automatiquement par `prisma migrate dev` (première fois que la
-- migration locale est appliquée via cet outil plutôt qu'à la main) — gardée
-- cette fois plutôt que ré-omise indéfiniment : aucune perte de données,
-- juste des noms de contrainte/index alignés sur le schéma actuel.
-- DropForeignKey
ALTER TABLE `speaker_media` DROP FOREIGN KEY `speaker_media_assets_reviewed_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `speaker_media` DROP FOREIGN KEY `speaker_media_assets_speaker_id_fkey`;

-- AlterTable
ALTER TABLE `speaker_media` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `speaker_media` ADD CONSTRAINT `speaker_media_speaker_id_fkey` FOREIGN KEY (`speaker_id`) REFERENCES `speakers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speaker_media` ADD CONSTRAINT `speaker_media_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `speaker_media_speaker_id_idx` ON `speaker_media`(`speaker_id`);
DROP INDEX `speaker_media_assets_speaker_id_idx` ON `speaker_media`;

-- RedefineIndex
CREATE INDEX `speaker_media_status_idx` ON `speaker_media`(`status`);
DROP INDEX `speaker_media_assets_status_idx` ON `speaker_media`;
