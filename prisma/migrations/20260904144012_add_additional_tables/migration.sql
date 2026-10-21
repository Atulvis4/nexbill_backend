-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `numberingDebitNoteNext` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `numberingDebitNotePrefix` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `payments_in` ADD COLUMN `purchaseReturnId` INTEGER NULL;

-- AlterTable
ALTER TABLE `purchase_invoices` ADD COLUMN `description` TEXT NULL;

-- AlterTable
ALTER TABLE `sales_invoices` ADD COLUMN `description` TEXT NULL;

-- CreateTable
CREATE TABLE `purchase_returns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyId` INTEGER NULL,
    `returnNo` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `originalBillId` INTEGER NULL,
    `returnType` ENUM('DEBIT_NOTE', 'REPLACEMENT') NOT NULL,
    `refundStatus` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `grandTotal` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_returns_returnNo_key`(`returnNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_return_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseReturnId` INTEGER NOT NULL,
    `itemId` INTEGER NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `hsn` VARCHAR(191) NULL,
    `qty` DECIMAL(12, 4) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `unitMultiplier` DECIMAL(12, 4) NOT NULL DEFAULT 1,
    `price` DECIMAL(12, 2) NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountIsPercentage` BOOLEAN NOT NULL DEFAULT false,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,
    `box` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payments_in` ADD CONSTRAINT `payments_in_purchaseReturnId_fkey` FOREIGN KEY (`purchaseReturnId`) REFERENCES `purchase_returns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_originalBillId_fkey` FOREIGN KEY (`originalBillId`) REFERENCES `purchase_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_rows` ADD CONSTRAINT `purchase_return_rows_purchaseReturnId_fkey` FOREIGN KEY (`purchaseReturnId`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_rows` ADD CONSTRAINT `purchase_return_rows_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
