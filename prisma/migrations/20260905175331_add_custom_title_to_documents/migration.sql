-- AlterTable
ALTER TABLE `delivery_challans` ADD COLUMN `customTitle` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `estimates` ADD COLUMN `customTitle` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `purchase_invoices` ADD COLUMN `customTitle` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sales_invoices` ADD COLUMN `customTitle` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sales_orders` ADD COLUMN `customTitle` VARCHAR(191) NULL;
