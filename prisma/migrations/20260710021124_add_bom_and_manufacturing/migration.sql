-- AlterTable
ALTER TABLE `items` ADD COLUMN `itemSubType` ENUM('RAW_MATERIAL', 'MANUFACTURED', 'CONSUMABLE') NULL;

-- CreateTable
CREATE TABLE `bom_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `finishedGoodId` INTEGER NOT NULL,
    `rawMaterialId` INTEGER NOT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,

    UNIQUE INDEX `bom_components_finishedGoodId_rawMaterialId_key`(`finishedGoodId`, `rawMaterialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `orderNo` VARCHAR(191) NOT NULL,
    `finishedGoodId` INTEGER NOT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,
    `status` ENUM('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bom_components` ADD CONSTRAINT `bom_components_finishedGoodId_fkey` FOREIGN KEY (`finishedGoodId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom_components` ADD CONSTRAINT `bom_components_rawMaterialId_fkey` FOREIGN KEY (`rawMaterialId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_orders` ADD CONSTRAINT `manufacturing_orders_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_orders` ADD CONSTRAINT `manufacturing_orders_finishedGoodId_fkey` FOREIGN KEY (`finishedGoodId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
