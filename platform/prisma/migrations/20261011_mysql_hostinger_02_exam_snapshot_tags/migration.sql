-- AlterTable
ALTER TABLE `exam_attempts` ADD COLUMN `passingBasisPoints` INTEGER NOT NULL DEFAULT 7000;

-- AlterTable
ALTER TABLE `tags` ADD COLUMN `title_ar` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `title_en` VARCHAR(191) NOT NULL DEFAULT '';
