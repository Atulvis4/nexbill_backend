-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `numberingPaymentOutNext` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `numberingPaymentOutPrefix` VARCHAR(191) NULL;
