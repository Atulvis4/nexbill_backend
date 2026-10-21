-- AlterTable
ALTER TABLE `delivery_challan_rows` ADD COLUMN `box` INTEGER NULL;

-- AlterTable
ALTER TABLE `estimate_rows` ADD COLUMN `box` INTEGER NULL;

-- AlterTable
ALTER TABLE `purchase_invoice_rows` ADD COLUMN `box` INTEGER NULL;

-- AlterTable
ALTER TABLE `sales_invoice_rows` ADD COLUMN `box` INTEGER NULL;

-- AlterTable
ALTER TABLE `sales_order_rows` ADD COLUMN `box` INTEGER NULL;

-- AlterTable
ALTER TABLE `sales_return_rows` ADD COLUMN `box` INTEGER NULL;
