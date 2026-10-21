-- CreateTable
CREATE TABLE `businesses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `gstin` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `billingAddress` TEXT NULL,
    `state` VARCHAR(191) NULL,
    `businessType` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `signatureUrl` VARCHAR(191) NULL,
    `gstEnabled` BOOLEAN NOT NULL DEFAULT false,
    `compositionScheme` BOOLEAN NOT NULL DEFAULT false,
    `defaultTaxRate` DECIMAL(12, 2) NULL,
    `rcmEnabled` BOOLEAN NOT NULL DEFAULT false,
    `showHsnColumn` BOOLEAN NOT NULL DEFAULT true,
    `calculateTaxBeforeDiscount` BOOLEAN NOT NULL DEFAULT false,
    `printTemplateStyle` VARCHAR(191) NULL,
    `printShowLogo` BOOLEAN NOT NULL DEFAULT true,
    `printBankDetails` TEXT NULL,
    `printTermsFooter` TEXT NULL,
    `numberingSalesPrefix` VARCHAR(191) NULL,
    `numberingSalesNext` INTEGER NOT NULL DEFAULT 1,
    `numberingPurchasePrefix` VARCHAR(191) NULL,
    `numberingPurchaseNext` INTEGER NOT NULL DEFAULT 1,
    `numberingEstimatePrefix` VARCHAR(191) NULL,
    `numberingEstimateNext` INTEGER NOT NULL DEFAULT 1,
    `numberingChallanPrefix` VARCHAR(191) NULL,
    `numberingChallanNext` INTEGER NOT NULL DEFAULT 1,
    `numberingOrderPrefix` VARCHAR(191) NULL,
    `numberingOrderNext` INTEGER NOT NULL DEFAULT 1,
    `numberingReturnPrefix` VARCHAR(191) NULL,
    `numberingReturnNext` INTEGER NOT NULL DEFAULT 1,
    `numberingReceiptPrefix` VARCHAR(191) NULL,
    `numberingReceiptNext` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'STAFF') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parties` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `billingAddress` TEXT NULL,
    `gstType` ENUM('UNREGISTERED', 'REGULAR', 'COMPOSITION', 'CONSUMER') NULL,
    `gstin` VARCHAR(191) NULL,
    `openingBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `balanceType` ENUM('RECEIVABLE', 'PAYABLE') NULL,
    `state` VARCHAR(191) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NULL,
    `parentCategoryId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `secondaryUnitId` INTEGER NULL,
    `multiplier` DECIMAL(12, 4) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('PRODUCT', 'SERVICE') NOT NULL,
    `hsn` VARCHAR(191) NULL,
    `itemCode` VARCHAR(191) NULL,
    `categoryId` INTEGER NULL,
    `unitId` INTEGER NULL,
    `description` TEXT NULL,
    `salePrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `salePriceType` ENUM('INCLUSIVE', 'EXCLUSIVE') NOT NULL DEFAULT 'EXCLUSIVE',
    `purchasePrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `purchasePriceType` ENUM('INCLUSIVE', 'EXCLUSIVE') NOT NULL DEFAULT 'EXCLUSIVE',
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `stockQuantity` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `stockValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `allocatedStock` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `minStock` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `asOfDate` DATETIME(3) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_ledgers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `type` ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,
    `adjustedValue` DECIMAL(12, 2) NULL,
    `description` VARCHAR(191) NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyId` INTEGER NULL,
    `invoiceNo` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `partyName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `stateOfSupply` VARCHAR(191) NULL,
    `isCash` BOOLEAN NOT NULL DEFAULT false,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `cgst` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `sgst` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `igst` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalTax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(12, 2) NOT NULL,
    `paid` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `balance` DECIMAL(12, 2) NOT NULL,
    `roundOff` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `termsText` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_invoices_invoiceNo_key`(`invoiceNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_invoice_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceId` INTEGER NOT NULL,
    `itemId` INTEGER NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `hsn` VARCHAR(191) NULL,
    `qty` DECIMAL(12, 4) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountIsPercentage` BOOLEAN NOT NULL DEFAULT false,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estimates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyId` INTEGER NULL,
    `estimateNo` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `partyName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `stateOfSupply` VARCHAR(191) NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `totalTax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(12, 2) NOT NULL,
    `termsText` TEXT NULL,
    `isConverted` BOOLEAN NOT NULL DEFAULT false,
    `convertedInvoiceId` INTEGER NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `estimates_estimateNo_key`(`estimateNo`),
    UNIQUE INDEX `estimates_convertedInvoiceId_key`(`convertedInvoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estimate_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estimateId` INTEGER NOT NULL,
    `itemId` INTEGER NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `hsn` VARCHAR(191) NULL,
    `qty` DECIMAL(12, 4) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountIsPercentage` BOOLEAN NOT NULL DEFAULT false,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments_in` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyId` INTEGER NULL,
    `bankAccountId` INTEGER NULL,
    `receiptNo` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `receivedAmount` DECIMAL(12, 2) NOT NULL,
    `paymentMode` ENUM('CASH', 'BANK', 'UPI', 'CHEQUE', 'CARD', 'OTHER') NOT NULL,
    `referenceNo` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_in_receiptNo_key`(`receiptNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_in_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentInId` INTEGER NOT NULL,
    `invoiceId` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments_out` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyId` INTEGER NULL,
    `bankAccountId` INTEGER NULL,
    `paymentNo` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paymentMode` ENUM('CASH', 'BANK', 'UPI', 'CHEQUE', 'CARD', 'OTHER') NOT NULL,
    `referenceNo` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_out_paymentNo_key`(`paymentNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_out_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentOutId` INTEGER NOT NULL,
    `purchaseInvoiceId` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_returns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyId` INTEGER NULL,
    `returnNo` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `originalInvoiceId` INTEGER NULL,
    `returnType` ENUM('CREDIT_NOTE', 'REPLACEMENT') NOT NULL,
    `grandTotal` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_returns_returnNo_key`(`returnNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_return_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salesReturnId` INTEGER NOT NULL,
    `itemId` INTEGER NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `hsn` VARCHAR(191) NULL,
    `qty` DECIMAL(12, 4) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountIsPercentage` BOOLEAN NOT NULL DEFAULT false,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_challans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyId` INTEGER NULL,
    `challanNo` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `stateOfSupply` VARCHAR(191) NULL,
    `transportDetails` TEXT NULL,
    `ewayBillNo` VARCHAR(191) NULL,
    `deliveryAddress` TEXT NULL,
    `grandTotal` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `termsText` TEXT NULL,
    `status` ENUM('PENDING', 'CONVERTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `convertedInvoiceId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `delivery_challans_challanNo_key`(`challanNo`),
    UNIQUE INDEX `delivery_challans_convertedInvoiceId_key`(`convertedInvoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_challan_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deliveryChallanId` INTEGER NOT NULL,
    `itemId` INTEGER NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `hsn` VARCHAR(191) NULL,
    `qty` DECIMAL(12, 4) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountIsPercentage` BOOLEAN NOT NULL DEFAULT false,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyId` INTEGER NULL,
    `orderNo` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `expectedDeliveryDate` DATETIME(3) NULL,
    `stateOfSupply` VARCHAR(191) NULL,
    `deliveryTerms` TEXT NULL,
    `advanceAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `advancePaymentMode` ENUM('CASH', 'BANK', 'UPI', 'CHEQUE', 'CARD', 'OTHER') NULL,
    `grandTotal` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `convertedInvoiceId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_orders_orderNo_key`(`orderNo`),
    UNIQUE INDEX `sales_orders_convertedInvoiceId_key`(`convertedInvoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_order_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salesOrderId` INTEGER NOT NULL,
    `itemId` INTEGER NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `hsn` VARCHAR(191) NULL,
    `qty` DECIMAL(12, 4) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountIsPercentage` BOOLEAN NOT NULL DEFAULT false,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `partyId` INTEGER NULL,
    `billNo` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `partyName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `stateOfSupply` VARCHAR(191) NULL,
    `paymentType` ENUM('CASH', 'CREDIT', 'BANK') NOT NULL DEFAULT 'CREDIT',
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `cgst` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `sgst` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `igst` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalTax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(12, 2) NOT NULL,
    `paid` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `balance` DECIMAL(12, 2) NOT NULL,
    `termsText` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_invoices_billNo_key`(`billNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_invoice_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseInvoiceId` INTEGER NOT NULL,
    `itemId` INTEGER NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `hsn` VARCHAR(191) NULL,
    `qty` DECIMAL(12, 4) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountIsPercentage` BOOLEAN NOT NULL DEFAULT false,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `accountType` ENUM('SAVINGS', 'CURRENT', 'OVERDRAFT', 'CASH') NOT NULL,
    `accountNumber` VARCHAR(191) NULL,
    `ifscCode` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `openingBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `currentBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `banking_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `bankAccountId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `type` ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `expenseCategoryName` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `note` TEXT NULL,
    `date` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessId` INTEGER NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storedPath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `business_members` ADD CONSTRAINT `business_members_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_members` ADD CONSTRAINT `business_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parties` ADD CONSTRAINT `parties_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parentCategoryId_fkey` FOREIGN KEY (`parentCategoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_secondaryUnitId_fkey` FOREIGN KEY (`secondaryUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoice_rows` ADD CONSTRAINT `sales_invoice_rows_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoice_rows` ADD CONSTRAINT `sales_invoice_rows_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimates` ADD CONSTRAINT `estimates_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimates` ADD CONSTRAINT `estimates_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimates` ADD CONSTRAINT `estimates_convertedInvoiceId_fkey` FOREIGN KEY (`convertedInvoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimate_rows` ADD CONSTRAINT `estimate_rows_estimateId_fkey` FOREIGN KEY (`estimateId`) REFERENCES `estimates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimate_rows` ADD CONSTRAINT `estimate_rows_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments_in` ADD CONSTRAINT `payments_in_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments_in` ADD CONSTRAINT `payments_in_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments_in` ADD CONSTRAINT `payments_in_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_in_allocations` ADD CONSTRAINT `payment_in_allocations_paymentInId_fkey` FOREIGN KEY (`paymentInId`) REFERENCES `payments_in`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_in_allocations` ADD CONSTRAINT `payment_in_allocations_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments_out` ADD CONSTRAINT `payments_out_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments_out` ADD CONSTRAINT `payments_out_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments_out` ADD CONSTRAINT `payments_out_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_out_allocations` ADD CONSTRAINT `payment_out_allocations_paymentOutId_fkey` FOREIGN KEY (`paymentOutId`) REFERENCES `payments_out`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_out_allocations` ADD CONSTRAINT `payment_out_allocations_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_originalInvoiceId_fkey` FOREIGN KEY (`originalInvoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_return_rows` ADD CONSTRAINT `sales_return_rows_salesReturnId_fkey` FOREIGN KEY (`salesReturnId`) REFERENCES `sales_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_return_rows` ADD CONSTRAINT `sales_return_rows_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_challans` ADD CONSTRAINT `delivery_challans_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_challans` ADD CONSTRAINT `delivery_challans_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_challans` ADD CONSTRAINT `delivery_challans_convertedInvoiceId_fkey` FOREIGN KEY (`convertedInvoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_challan_rows` ADD CONSTRAINT `delivery_challan_rows_deliveryChallanId_fkey` FOREIGN KEY (`deliveryChallanId`) REFERENCES `delivery_challans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_challan_rows` ADD CONSTRAINT `delivery_challan_rows_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_convertedInvoiceId_fkey` FOREIGN KEY (`convertedInvoiceId`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_order_rows` ADD CONSTRAINT `sales_order_rows_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_order_rows` ADD CONSTRAINT `sales_order_rows_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_invoices` ADD CONSTRAINT `purchase_invoices_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_invoices` ADD CONSTRAINT `purchase_invoices_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_invoice_rows` ADD CONSTRAINT `purchase_invoice_rows_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_invoice_rows` ADD CONSTRAINT `purchase_invoice_rows_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banking_transactions` ADD CONSTRAINT `banking_transactions_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banking_transactions` ADD CONSTRAINT `banking_transactions_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discounts` ADD CONSTRAINT `discounts_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `files` ADD CONSTRAINT `files_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
