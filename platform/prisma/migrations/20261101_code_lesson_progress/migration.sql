CREATE TABLE `code_lesson_progress` (
  `userId` VARCHAR(191) NOT NULL,
  `lessonId` VARCHAR(100) NOT NULL,
  `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `code_lesson_progress_completedAt_idx`(`completedAt`),
  PRIMARY KEY (`userId`, `lessonId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `code_lesson_progress` ADD CONSTRAINT `code_lesson_progress_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
