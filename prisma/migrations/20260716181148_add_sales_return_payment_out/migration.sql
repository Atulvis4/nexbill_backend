-- AlterTable
ALTER TABLE `payments_out` ADD COLUMN `salesReturnId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `payments_out` ADD CONSTRAINT `payments_out_salesReturnId_fkey` FOREIGN KEY (`salesReturnId`) REFERENCES `sales_returns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
