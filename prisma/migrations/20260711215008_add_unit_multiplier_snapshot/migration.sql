-- AlterTable
ALTER TABLE `delivery_challan_rows` ADD COLUMN `unitMultiplier` DECIMAL(12, 4) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `estimate_rows` ADD COLUMN `unitMultiplier` DECIMAL(12, 4) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `purchase_invoice_rows` ADD COLUMN `unitMultiplier` DECIMAL(12, 4) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `sales_invoice_rows` ADD COLUMN `unitMultiplier` DECIMAL(12, 4) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `sales_order_rows` ADD COLUMN `unitMultiplier` DECIMAL(12, 4) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `sales_return_rows` ADD COLUMN `unitMultiplier` DECIMAL(12, 4) NOT NULL DEFAULT 1;
