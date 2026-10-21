-- AlterTable
ALTER TABLE `purchase_invoices` ADD COLUMN `discountIsPercentage` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales_invoices` ADD COLUMN `discountIsPercentage` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0;
