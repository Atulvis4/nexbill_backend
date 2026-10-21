-- AlterTable
ALTER TABLE `sales_returns` ADD COLUMN `refundStatus` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING';
