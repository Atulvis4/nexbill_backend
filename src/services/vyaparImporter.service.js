import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';

/**
 * Resolves the actual SQLite database file from a path, which can be:
 * 1. A direct SQLite file (.vyp, .db, .sqlite)
 * 2. A zip/vyb archive containing SQLite database file(s)
 * 3. A directory containing a .vyp or .sqlite file (e.g. Windows Vyapar desktop backup folder)
 */
export const resolveSqlitePath = (inputPath) => {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`File or directory does not exist: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(inputPath);
    const candidate = files.find(
      (f) => f.endsWith('.vyp') || f.endsWith('.db') || f.endsWith('.sqlite') || f.endsWith('.vyb')
    );
    if (!candidate) {
      throw new Error(`No SQLite database file (.vyp/.db/.sqlite) found inside directory: ${inputPath}`);
    }
    return resolveSqlitePath(path.join(inputPath, candidate));
  }

  // Check if file is a ZIP archive (starts with PK\x03\x04: 0x50, 0x4B, 0x03, 0x04)
  try {
    const buf = Buffer.alloc(4);
    const fd = fs.openSync(inputPath, 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);

    if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
      const extractDir = path.join(path.dirname(inputPath), `extracted_${Date.now()}`);
      fs.mkdirSync(extractDir, { recursive: true });
      const zip = new AdmZip(inputPath);
      zip.extractAllTo(extractDir, true);
      return resolveSqlitePath(extractDir);
    }
  } catch (err) {
    logger.warn(`Could not check/extract zip header from ${inputPath}: ${err.message}`);
  }

  return inputPath;
};

/**
 * Helper to chunk an array for bulk DB operations
 */
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

/**
 * Maps Vyapar payment type id to NexBill PaymentMode enum
 */
const getPaymentMode = (typeId) => {
  if (typeId === 1) return 'CASH';
  if (typeId === 2) return 'CHEQUE';
  if (typeId === 5) return 'BANK';
  return 'OTHER';
};

/**
 * Imports a Vyapar SQLite backup into the specified businessId in NexBill
 */
export const importVyaparBackup = async (businessId, targetPath) => {
  const startTime = Date.now();
  const sqliteFile = resolveSqlitePath(targetPath);
  logger.info(`Starting high-speed Vyapar database import from: ${sqliteFile} for businessId: ${businessId}`);

  const db = new DatabaseSync(sqliteFile, { open: true, readOnly: true });

  try {
    // 1. Fetch Firm details
    const firm =
      db.prepare('SELECT * FROM kb_firms WHERE firm_id = 1').get() ||
      db.prepare('SELECT * FROM kb_firms LIMIT 1').get();

    const businessState = firm?.firm_state || 'Maharashtra';

    if (firm) {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          name: firm.firm_name || 'R.A LIGHT',
          phone: firm.firm_phone || null,
          email: firm.firm_email || null,
          billingAddress: firm.firm_address || null,
          gstin: firm.firm_gstin_number || null,
          state: firm.firm_state || null,
        },
      });
      logger.info(`Updated business profile for businessId ${businessId}: ${firm.firm_name}`);
    }

    // 2. Clean existing data for this businessId to prevent duplicates
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
    try {
      await prisma.salesInvoiceRow.deleteMany({ where: { invoice: { businessId } } });
      await prisma.purchaseInvoiceRow.deleteMany({ where: { purchaseInvoice: { businessId } } });
      await prisma.paymentInAllocation.deleteMany({ where: { paymentIn: { businessId } } });
      await prisma.paymentOutAllocation.deleteMany({ where: { paymentOut: { businessId } } });
      await prisma.salesReturnRow.deleteMany({ where: { salesReturn: { businessId } } });
      await prisma.purchaseReturnRow.deleteMany({ where: { purchaseReturn: { businessId } } });
      await prisma.deliveryChallanRow.deleteMany({ where: { deliveryChallan: { businessId } } });
      await prisma.salesOrderRow.deleteMany({ where: { salesOrder: { businessId } } });
      await prisma.estimateRow.deleteMany({ where: { estimate: { businessId } } });

      await prisma.salesInvoice.deleteMany({ where: { businessId } });
      await prisma.purchaseInvoice.deleteMany({ where: { businessId } });
      await prisma.paymentIn.deleteMany({ where: { businessId } });
      await prisma.paymentOut.deleteMany({ where: { businessId } });
      await prisma.salesReturn.deleteMany({ where: { businessId } });
      await prisma.purchaseReturn.deleteMany({ where: { businessId } });
      await prisma.deliveryChallan.deleteMany({ where: { businessId } });
      await prisma.salesOrder.deleteMany({ where: { businessId } });
      await prisma.estimate.deleteMany({ where: { businessId } });
      await prisma.expense.deleteMany({ where: { businessId } });
      await prisma.bankingTransaction.deleteMany({ where: { businessId } });
      await prisma.stockLedger.deleteMany({ where: { businessId } });

      await prisma.item.deleteMany({ where: { businessId } });
      await prisma.category.deleteMany({ where: { businessId } });
      await prisma.unit.deleteMany({ where: { businessId } });
      await prisma.bankAccount.deleteMany({ where: { businessId } });
      await prisma.party.deleteMany({ where: { businessId } });
    } finally {
      await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    }
    logger.info(`Cleaned existing records for businessId: ${businessId}`);

    // 3. Units
    const vyUnits = db.prepare('SELECT * FROM kb_item_units').all();
    const unitIdMap = new Map();
    const unitShortNameMap = new Map();

    for (const u of vyUnits) {
      const created = await prisma.unit.create({
        data: {
          businessId,
          name: u.unit_name || 'Unit',
          code: u.unit_short_name || u.unit_name || 'U',
        },
      });
      unitIdMap.set(u.unit_id, created.id);
      unitShortNameMap.set(u.unit_id, created.code);
    }
    logger.info(`Imported ${unitIdMap.size} units`);

    // 4. Categories
    const vyCats = db.prepare('SELECT * FROM kb_item_categories').all();
    const catIdMap = new Map();
    for (const c of vyCats) {
      const created = await prisma.category.create({
        data: {
          businessId,
          name: c.item_category_name || 'General',
        },
      });
      catIdMap.set(c.item_category_id, created.id);
    }
    logger.info(`Imported ${catIdMap.size} categories`);

    // 5. Bank Accounts
    const vyBanks = db.prepare('SELECT * FROM kb_paymentTypes').all();
    const bankIdMap = new Map();
    for (const b of vyBanks) {
      let accType = 'CASH';
      const rawType = (b.paymentType_type || '').toUpperCase();
      if (rawType.includes('BANK')) accType = 'CURRENT';
      else if (rawType.includes('CHEQUE')) accType = 'CURRENT';

      const created = await prisma.bankAccount.create({
        data: {
          businessId,
          name: b.paymentType_name || 'Account',
          accountType: accType,
          accountNumber: b.paymentType_accountNumber || null,
          ifscCode: b.pt_bank_ifsc_code || null,
          bankName: b.paymentType_bankName || null,
          openingBalance: Number(b.paymentType_opening_balance || 0),
          currentBalance: Number(b.paymentType_opening_balance || 0),
        },
      });
      bankIdMap.set(b.paymentType_id, created.id);
    }
    logger.info(`Imported ${bankIdMap.size} bank/cash accounts`);

    // 6. Parties (kb_names) with Exact Mathematical Balance Matching
    // Calculate net transaction effect for each party from active transactions (txn_status != 2)
    const activeTxns = db
      .prepare(
        'SELECT txn_name_id, txn_type, txn_cash_amount, txn_balance_amount FROM kb_transactions WHERE txn_status != 2 AND txn_name_id IS NOT NULL'
      )
      .all();
    const partyNetTxnMap = new Map();

    for (const t of activeTxns) {
      const nid = t.txn_name_id;
      const cash = Number(t.txn_cash_amount || 0);
      const bal = Number(t.txn_balance_amount || 0);
      const total = cash + bal;
      const current = partyNetTxnMap.get(nid) || 0;

      if (t.txn_type === 1) {
        // Sales Invoice
        partyNetTxnMap.set(nid, current + total);
      } else if (t.txn_type === 2) {
        // Purchase Invoice
        partyNetTxnMap.set(nid, current - total);
      } else if (t.txn_type === 3) {
        // Payment In
        partyNetTxnMap.set(nid, current - (cash || bal));
      } else if (t.txn_type === 4) {
        // Payment Out
        partyNetTxnMap.set(nid, current + (cash || bal));
      } else if (t.txn_type === 27) {
        // Sales Return (Credit Note)
        partyNetTxnMap.set(nid, current - total);
      } else if (t.txn_type === 65) {
        // Purchase Return (Debit Note)
        partyNetTxnMap.set(nid, current + total);
      }
    }

    const vyParties = db.prepare('SELECT * FROM kb_names').all();
    const partyIdMap = new Map();
    const partyNameMap = new Map();
    const partyPhoneMap = new Map();

    const partyChunks = chunkArray(vyParties, 50);
    for (const chunk of partyChunks) {
      const results = await Promise.all(
        chunk.map((p) => {
          const target = Number(p.amount || 0);
          const netTxn = partyNetTxnMap.get(p.name_id) || 0;
          const delta = Math.round((target - netTxn) * 100) / 100;

          let openingBalance = 0;
          let balanceType = 'RECEIVABLE';
          if (delta > 0.0001) {
            openingBalance = delta;
            balanceType = 'RECEIVABLE';
          } else if (delta < -0.0001) {
            openingBalance = Math.abs(delta);
            balanceType = 'PAYABLE';
          }

          const gstin = (p.name_gstin_number || '').trim();
          const gstType = gstin && gstin.length === 15 ? 'REGULAR' : 'UNREGISTERED';

          return prisma.party.create({
            data: {
              businessId,
              partyName: p.full_name || 'Unnamed Party',
              phone: p.phone_number || null,
              email: p.email || null,
              billingAddress: p.address || null,
              gstType,
              gstin: gstin || null,
              state: p.name_state || null,
              openingBalance,
              balanceType,
              isArchived: p.name_is_active === 0,
            },
          });
        })
      );

      results.forEach((created, idx) => {
        partyIdMap.set(chunk[idx].name_id, created.id);
        partyNameMap.set(chunk[idx].name_id, created.partyName);
        partyPhoneMap.set(chunk[idx].name_id, created.phone);
      });
    }
    logger.info(`Imported ${partyIdMap.size} parties`);

    // 7. Items (kb_items)
    const vyItems = db.prepare('SELECT * FROM kb_items').all();
    const itemIdMap = new Map();
    const itemNameMap = new Map();
    const itemHsnMap = new Map();
    const itemUnitNameMap = new Map();

    const itemChunks = chunkArray(vyItems, 100);
    for (const chunk of itemChunks) {
      const results = await Promise.all(
        chunk.map((item) => {
          const uId = unitIdMap.get(item.base_unit_id) || null;
          const cId = catIdMap.get(item.category_id) || null;

          return prisma.item.create({
            data: {
              businessId,
              name: item.item_name || 'Unnamed Item',
              itemCode: item.item_code || null,
              hsn: item.item_hsn_sac_code || null,
              type: 'PRODUCT',
              unitId: uId,
              categoryId: cId,
              purchasePrice: Number(item.item_purchase_unit_price || 0),
              salePrice: Number(item.item_sale_unit_price || item.item_catalogue_sale_unit_price || 0),
              stockQuantity: Number(item.item_stock_quantity || 0),
              stockValue: Number(item.item_stock_value || 0),
              minStock: Number(item.item_min_stock_quantity || 0),
              isArchived: item.item_is_active === 0,
            },
          });
        })
      );

      results.forEach((created, idx) => {
        const originalItem = chunk[idx];
        itemIdMap.set(originalItem.item_id, created.id);
        itemNameMap.set(originalItem.item_id, created.name);
        itemHsnMap.set(originalItem.item_id, originalItem.item_hsn_sac_code || '');
        itemUnitNameMap.set(originalItem.item_id, unitShortNameMap.get(originalItem.base_unit_id) || 'Pcs');
      });
    }
    logger.info(`Imported ${itemIdMap.size} inventory items`);

    // 8. Pre-fetch Line Items indexed by txn_id
    logger.info('Indexing line items from SQLite...');
    const allLineitems = db.prepare('SELECT * FROM kb_lineitems').all();
    const lineitemsByTxn = new Map();
    for (const li of allLineitems) {
      if (!lineitemsByTxn.has(li.lineitem_txn_id)) {
        lineitemsByTxn.set(li.lineitem_txn_id, []);
      }
      lineitemsByTxn.get(li.lineitem_txn_id).push(li);
    }
    logger.info(`Indexed ${allLineitems.length} line items across transactions`);

    // 9. Process Sales Invoices (txn_type = 1) with Global Collision Avoidance
    const otherInvoices = await prisma.salesInvoice.findMany({
      where: { businessId: { not: businessId } },
      select: { invoiceNo: true },
    });
    const globallyUsedInvoiceNos = new Set(otherInvoices.map((i) => i.invoiceNo));
    const usedInBatchSales = new Set();

    const salesTxns = db
      .prepare('SELECT * FROM kb_transactions WHERE txn_type = 1 AND txn_status != 2 ORDER BY txn_id ASC')
      .all();
    const txnToInvNo = new Map();
    const salesInvoicesData = [];

    for (const t of salesTxns) {
      const rawNo = (t.txn_ref_number_char || '').trim();
      let invNo = rawNo;

      // Ensure global uniqueness across MariaDB
      if (!invNo || globallyUsedInvoiceNos.has(invNo) || usedInBatchSales.has(invNo)) {
        invNo = rawNo ? `${rawNo}-${businessId}` : `INV-${businessId}-${t.txn_id}`;
        if (globallyUsedInvoiceNos.has(invNo) || usedInBatchSales.has(invNo)) {
          invNo = `INV-${businessId}-${t.txn_id}`;
        }
      }
      usedInBatchSales.add(invNo);
      txnToInvNo.set(t.txn_id, invNo);

      const pId = partyIdMap.get(t.txn_name_id) || null;
      const pName = partyNameMap.get(t.txn_name_id) || 'Cash Sale';
      const phone = t.mobile_no || (t.txn_name_id ? partyPhoneMap.get(t.txn_name_id) : null) || null;
      const rawCash = Number(t.txn_cash_amount || 0);
      const rawBal = Number(t.txn_balance_amount || 0);
      const grandTotal = rawCash + rawBal;
      const balance = Number(t.txn_current_balance || 0);
      const paid = Math.max(0, grandTotal - balance);
      const totalTax = Number(t.txn_tax_amount || 0);
      const discountValue = Number(t.txn_discount_amount || 0);
      const subtotal = Math.max(0, grandTotal - totalTax + discountValue);

      // Split taxes according to place of supply
      const supplyState = t.txn_place_of_supply || businessState;
      const isInterstate = supplyState.toLowerCase() !== businessState.toLowerCase();
      const cgst = isInterstate ? 0 : totalTax / 2;
      const sgst = isInterstate ? 0 : totalTax / 2;
      const igst = isInterstate ? totalTax : 0;

      salesInvoicesData.push({
        businessId,
        partyId: pId,
        invoiceNo: invNo,
        date: new Date(t.txn_date || t.txn_date_created),
        partyName: pName,
        phone,
        stateOfSupply: t.txn_place_of_supply || null,
        subtotal,
        discountValue,
        cgst,
        sgst,
        igst,
        totalTax,
        grandTotal,
        paid,
        balance,
        isCash: balance === 0,
        roundOff: Number(t.txn_round_off_amount || 0),
        termsText: t.txn_description || null,
      });
    }

    for (const chunk of chunkArray(salesInvoicesData, 500)) {
      await prisma.salesInvoice.createMany({ data: chunk });
    }

    const insertedSales = await prisma.salesInvoice.findMany({
      where: { businessId },
      select: { id: true, invoiceNo: true },
    });
    const invNoToId = new Map(insertedSales.map((i) => [i.invoiceNo, i.id]));

    // Bulk insert sales rows
    const salesRowsData = [];
    for (const t of salesTxns) {
      const invNo = txnToInvNo.get(t.txn_id);
      const invId = invNoToId.get(invNo);
      if (!invId) continue;

      const rows = lineitemsByTxn.get(t.txn_id) || [];
      for (const r of rows) {
        salesRowsData.push({
          invoiceId: invId,
          itemId: itemIdMap.get(r.item_id) || null,
          itemName: itemNameMap.get(r.item_id) || r.lineitem_description || 'Product',
          hsn: itemHsnMap.get(r.item_id) || null,
          unit: itemUnitNameMap.get(r.item_id) || 'Pcs',
          qty: Number(r.quantity || 1),
          price: Number(r.priceperunit || 0),
          discountValue: Number(r.lineitem_discount_amount || 0),
          taxAmount: Number(r.lineitem_tax_amount || 0),
          total: Number(r.total_amount || 0),
        });
      }
    }

    for (const chunk of chunkArray(salesRowsData, 1000)) {
      await prisma.salesInvoiceRow.createMany({ data: chunk });
    }
    logger.info(`Imported ${salesInvoicesData.length} sales invoices with ${salesRowsData.length} rows`);

    // 10. Process Purchases (txn_type = 2) with Global Collision Avoidance
    const otherPurchases = await prisma.purchaseInvoice.findMany({
      where: { businessId: { not: businessId } },
      select: { billNo: true },
    });
    const globallyUsedBillNos = new Set(otherPurchases.map((p) => p.billNo));
    const usedInBatchPurchases = new Set();

    const purchaseTxns = db
      .prepare('SELECT * FROM kb_transactions WHERE txn_type = 2 AND txn_status != 2 ORDER BY txn_id ASC')
      .all();
    const txnToBillNo = new Map();
    const purchaseInvoicesData = [];

    for (const t of purchaseTxns) {
      const rawNo = (t.txn_ref_number_char || '').trim();
      let billNo = rawNo;

      if (!billNo || globallyUsedBillNos.has(billNo) || usedInBatchPurchases.has(billNo)) {
        billNo = rawNo ? `${rawNo}-${businessId}` : `BILL-${businessId}-${t.txn_id}`;
        if (globallyUsedBillNos.has(billNo) || usedInBatchPurchases.has(billNo)) {
          billNo = `BILL-${businessId}-${t.txn_id}`;
        }
      }
      usedInBatchPurchases.add(billNo);
      txnToBillNo.set(t.txn_id, billNo);

      const pId = partyIdMap.get(t.txn_name_id) || null;
      const pName = partyNameMap.get(t.txn_name_id) || 'Cash Purchase';
      const phone = t.mobile_no || (t.txn_name_id ? partyPhoneMap.get(t.txn_name_id) : null) || null;
      const rawCash = Number(t.txn_cash_amount || 0);
      const rawBal = Number(t.txn_balance_amount || 0);
      const grandTotal = rawCash + rawBal;
      const balance = Number(t.txn_current_balance || 0);
      const paid = Math.max(0, grandTotal - balance);
      const totalTax = Number(t.txn_tax_amount || 0);
      const discountValue = Number(t.txn_discount_amount || 0);
      const subtotal = Math.max(0, grandTotal - totalTax + discountValue);

      const supplyState = t.txn_place_of_supply || businessState;
      const isInterstate = supplyState.toLowerCase() !== businessState.toLowerCase();
      const cgst = isInterstate ? 0 : totalTax / 2;
      const sgst = isInterstate ? 0 : totalTax / 2;
      const igst = isInterstate ? totalTax : 0;

      purchaseInvoicesData.push({
        businessId,
        partyId: pId,
        billNo,
        date: new Date(t.txn_date || t.txn_date_created),
        partyName: pName,
        phone,
        stateOfSupply: t.txn_place_of_supply || null,
        paymentType: balance === 0 ? 'CASH' : 'CREDIT',
        subtotal,
        discountValue,
        cgst,
        sgst,
        igst,
        totalTax,
        grandTotal,
        paid,
        balance,
        termsText: t.txn_description || null,
      });
    }

    for (const chunk of chunkArray(purchaseInvoicesData, 500)) {
      await prisma.purchaseInvoice.createMany({ data: chunk });
    }

    const insertedPurchases = await prisma.purchaseInvoice.findMany({
      where: { businessId },
      select: { id: true, billNo: true },
    });
    const billNoToId = new Map(insertedPurchases.map((p) => [p.billNo, p.id]));

    // Bulk insert purchase rows
    const purchaseRowsData = [];
    for (const t of purchaseTxns) {
      const billNo = txnToBillNo.get(t.txn_id);
      const pInvId = billNoToId.get(billNo);
      if (!pInvId) continue;

      const rows = lineitemsByTxn.get(t.txn_id) || [];
      for (const r of rows) {
        purchaseRowsData.push({
          purchaseInvoiceId: pInvId,
          itemId: itemIdMap.get(r.item_id) || null,
          itemName: itemNameMap.get(r.item_id) || r.lineitem_description || 'Product',
          hsn: itemHsnMap.get(r.item_id) || null,
          unit: itemUnitNameMap.get(r.item_id) || 'Pcs',
          qty: Number(r.quantity || 1),
          price: Number(r.priceperunit || 0),
          discountValue: Number(r.lineitem_discount_amount || 0),
          taxAmount: Number(r.lineitem_tax_amount || 0),
          total: Number(r.total_amount || 0),
        });
      }
    }

    for (const chunk of chunkArray(purchaseRowsData, 1000)) {
      await prisma.purchaseInvoiceRow.createMany({ data: chunk });
    }
    logger.info(`Imported ${purchaseInvoicesData.length} purchase bills with ${purchaseRowsData.length} rows`);

    // 11. Payments In (txn_type = 3) with Collision Avoidance
    const otherPayIns = await prisma.paymentIn.findMany({
      where: { businessId: { not: businessId } },
      select: { receiptNo: true },
    });
    const globallyUsedReceiptNos = new Set(otherPayIns.map((p) => p.receiptNo));
    const usedInBatchReceipts = new Set();

    const payInTxns = db
      .prepare('SELECT * FROM kb_transactions WHERE txn_type = 3 AND txn_status != 2 ORDER BY txn_id ASC')
      .all();
    const txnToReceiptNo = new Map();
    const payInRecords = [];

    for (const t of payInTxns) {
      const rawNo = (t.txn_ref_number_char || '').trim();
      let receiptNo = rawNo;

      if (!receiptNo || globallyUsedReceiptNos.has(receiptNo) || usedInBatchReceipts.has(receiptNo)) {
        receiptNo = rawNo ? `${rawNo}-${businessId}` : `REC-${businessId}-${t.txn_id}`;
        if (globallyUsedReceiptNos.has(receiptNo) || usedInBatchReceipts.has(receiptNo)) {
          receiptNo = `REC-${businessId}-${t.txn_id}`;
        }
      }
      usedInBatchReceipts.add(receiptNo);
      txnToReceiptNo.set(t.txn_id, receiptNo);

      const pId = partyIdMap.get(t.txn_name_id) || null;
      const bId = bankIdMap.get(t.txn_payment_type_id) || null;
      const amount = Number(t.txn_cash_amount || t.txn_balance_amount || 0);

      payInRecords.push({
        businessId,
        partyId: pId,
        bankAccountId: bId,
        receiptNo,
        date: new Date(t.txn_date || t.txn_date_created),
        receivedAmount: amount,
        paymentMode: getPaymentMode(t.txn_payment_type_id),
        description: t.txn_description || 'Payment In (Vyapar)',
      });
    }

    for (const chunk of chunkArray(payInRecords, 500)) {
      await prisma.paymentIn.createMany({ data: chunk });
    }

    const insertedPayIns = await prisma.paymentIn.findMany({
      where: { businessId },
      select: { id: true, receiptNo: true },
    });
    const receiptNoToId = new Map(insertedPayIns.map((p) => [p.receiptNo, p.id]));
    logger.info(`Imported ${payInRecords.length} Payment In vouchers`);

    // 12. Payments Out (txn_type = 4) with Collision Avoidance
    const otherPayOuts = await prisma.paymentOut.findMany({
      where: { businessId: { not: businessId } },
      select: { paymentNo: true },
    });
    const globallyUsedPayNos = new Set(otherPayOuts.map((p) => p.paymentNo));
    const usedInBatchPayOuts = new Set();

    const payOutTxns = db
      .prepare('SELECT * FROM kb_transactions WHERE txn_type = 4 AND txn_status != 2 ORDER BY txn_id ASC')
      .all();
    const txnToPayNo = new Map();
    const payOutRecords = [];

    for (const t of payOutTxns) {
      const rawNo = (t.txn_ref_number_char || '').trim();
      let paymentNo = rawNo;

      if (!paymentNo || globallyUsedPayNos.has(paymentNo) || usedInBatchPayOuts.has(paymentNo)) {
        paymentNo = rawNo ? `${rawNo}-${businessId}` : `PAY-${businessId}-${t.txn_id}`;
        if (globallyUsedPayNos.has(paymentNo) || usedInBatchPayOuts.has(paymentNo)) {
          paymentNo = `PAY-${businessId}-${t.txn_id}`;
        }
      }
      usedInBatchPayOuts.add(paymentNo);
      txnToPayNo.set(t.txn_id, paymentNo);

      const pId = partyIdMap.get(t.txn_name_id) || null;
      const bId = bankIdMap.get(t.txn_payment_type_id) || null;
      const amount = Number(t.txn_cash_amount || t.txn_balance_amount || 0);

      payOutRecords.push({
        businessId,
        partyId: pId,
        bankAccountId: bId,
        paymentNo,
        date: new Date(t.txn_date || t.txn_date_created),
        amount,
        paymentMode: getPaymentMode(t.txn_payment_type_id),
        description: t.txn_description || 'Payment Out (Vyapar)',
      });
    }

    for (const chunk of chunkArray(payOutRecords, 500)) {
      await prisma.paymentOut.createMany({ data: chunk });
    }

    const insertedPayOuts = await prisma.paymentOut.findMany({
      where: { businessId },
      select: { id: true, paymentNo: true },
    });
    const payNoToId = new Map(insertedPayOuts.map((p) => [p.paymentNo, p.id]));
    logger.info(`Imported ${payOutRecords.length} Payment Out vouchers`);

    // 13. Payment Allocations from kb_txn_links
    const vyLinks = db.prepare('SELECT * FROM kb_txn_links').all();
    const payInAllocations = [];
    const payOutAllocations = [];

    for (const l of vyLinks) {
      // PaymentIn -> SalesInvoice (txn_1 = 3, txn_2 = 1)
      if (l.txn_links_txn_1_type === 3 && l.txn_links_txn_2_type === 1) {
        const rNo = txnToReceiptNo.get(l.txn_links_txn_1_id);
        const iNo = txnToInvNo.get(l.txn_links_txn_2_id);
        const pInId = rNo ? receiptNoToId.get(rNo) : null;
        const invId = iNo ? invNoToId.get(iNo) : null;
        if (pInId && invId) {
          payInAllocations.push({
            paymentInId: pInId,
            invoiceId: invId,
            amount: Number(l.txn_links_amount || 0),
          });
        }
      }
      // PaymentOut -> PurchaseInvoice (txn_1 = 4, txn_2 = 2)
      else if (l.txn_links_txn_1_type === 4 && l.txn_links_txn_2_type === 2) {
        const pNo = txnToPayNo.get(l.txn_links_txn_1_id);
        const bNo = txnToBillNo.get(l.txn_links_txn_2_id);
        const pOutId = pNo ? payNoToId.get(pNo) : null;
        const pInvId = bNo ? billNoToId.get(bNo) : null;
        if (pOutId && pInvId) {
          payOutAllocations.push({
            paymentOutId: pOutId,
            purchaseInvoiceId: pInvId,
            amount: Number(l.txn_links_amount || 0),
          });
        }
      }
    }

    for (const chunk of chunkArray(payInAllocations, 1000)) {
      await prisma.paymentInAllocation.createMany({ data: chunk });
    }
    for (const chunk of chunkArray(payOutAllocations, 1000)) {
      await prisma.paymentOutAllocation.createMany({ data: chunk });
    }
    logger.info(
      `Imported ${payInAllocations.length} Payment In allocations and ${payOutAllocations.length} Payment Out allocations`
    );

    // 14. Sales Returns / Credit Notes (txn_type = 27) with Collision Avoidance
    const otherReturns = await prisma.salesReturn.findMany({
      where: { businessId: { not: businessId } },
      select: { returnNo: true },
    });
    const globallyUsedReturnNos = new Set(otherReturns.map((r) => r.returnNo));
    const usedInBatchReturns = new Set();

    const creditNotes = db
      .prepare('SELECT * FROM kb_transactions WHERE txn_type = 27 AND txn_status != 2 ORDER BY txn_id ASC')
      .all();
    const txnToReturnNo = new Map();
    const salesReturnsData = [];

    for (const t of creditNotes) {
      const rawNo = (t.txn_ref_number_char || '').trim();
      let returnNo = rawNo;

      if (!returnNo || globallyUsedReturnNos.has(returnNo) || usedInBatchReturns.has(returnNo)) {
        returnNo = rawNo ? `${rawNo}-${businessId}` : `CN-${businessId}-${t.txn_id}`;
        if (globallyUsedReturnNos.has(returnNo) || usedInBatchReturns.has(returnNo)) {
          returnNo = `CN-${businessId}-${t.txn_id}`;
        }
      }
      usedInBatchReturns.add(returnNo);
      txnToReturnNo.set(t.txn_id, returnNo);

      const pId = partyIdMap.get(t.txn_name_id) || null;
      const grandTotal = Number(t.txn_cash_amount || t.txn_balance_amount || 0);

      salesReturnsData.push({
        businessId,
        partyId: pId,
        returnNo,
        date: new Date(t.txn_date || t.txn_date_created),
        returnType: 'CREDIT_NOTE',
        grandTotal,
        refundStatus: Number(t.txn_cash_amount || 0) > 0 ? 'PAID' : 'PENDING',
        notes: t.txn_description || null,
      });
    }

    for (const chunk of chunkArray(salesReturnsData, 500)) {
      await prisma.salesReturn.createMany({ data: chunk });
    }

    const insertedSalesReturns = await prisma.salesReturn.findMany({
      where: { businessId },
      select: { id: true, returnNo: true },
    });
    const returnNoToId = new Map(insertedSalesReturns.map((r) => [r.returnNo, r.id]));

    const salesReturnRowsData = [];
    for (const t of creditNotes) {
      const rNo = txnToReturnNo.get(t.txn_id);
      const srId = returnNoToId.get(rNo);
      if (!srId) continue;

      const rows = lineitemsByTxn.get(t.txn_id) || [];
      for (const r of rows) {
        salesReturnRowsData.push({
          salesReturnId: srId,
          itemId: itemIdMap.get(r.item_id) || null,
          itemName: itemNameMap.get(r.item_id) || r.lineitem_description || 'Returned Product',
          qty: Number(r.quantity || 1),
          price: Number(r.priceperunit || 0),
          total: Number(r.total_amount || 0),
        });
      }
    }

    for (const chunk of chunkArray(salesReturnRowsData, 1000)) {
      await prisma.salesReturnRow.createMany({ data: chunk });
    }
    logger.info(`Imported ${salesReturnsData.length} sales returns / credit notes`);

    // 15. Purchase Returns / Debit Notes (txn_type = 65) with Collision Avoidance
    const otherDebitNotes = await prisma.purchaseReturn.findMany({
      where: { businessId: { not: businessId } },
      select: { returnNo: true },
    });
    const globallyUsedDebitNos = new Set(otherDebitNotes.map((r) => r.returnNo));
    const usedInBatchDebitNotes = new Set();

    const debitNotes = db
      .prepare('SELECT * FROM kb_transactions WHERE txn_type = 65 AND txn_status != 2 ORDER BY txn_id ASC')
      .all();
    const txnToDebitNo = new Map();
    const purchaseReturnsData = [];

    for (const t of debitNotes) {
      const rawNo = (t.txn_ref_number_char || '').trim();
      let returnNo = rawNo;

      if (!returnNo || globallyUsedDebitNos.has(returnNo) || usedInBatchDebitNotes.has(returnNo)) {
        returnNo = rawNo ? `${rawNo}-${businessId}` : `DN-${businessId}-${t.txn_id}`;
        if (globallyUsedDebitNos.has(returnNo) || usedInBatchDebitNotes.has(returnNo)) {
          returnNo = `DN-${businessId}-${t.txn_id}`;
        }
      }
      usedInBatchDebitNotes.add(returnNo);
      txnToDebitNo.set(t.txn_id, returnNo);

      const pId = partyIdMap.get(t.txn_name_id) || null;
      const grandTotal = Number(t.txn_cash_amount || t.txn_balance_amount || 0);

      purchaseReturnsData.push({
        businessId,
        partyId: pId,
        returnNo,
        date: new Date(t.txn_date || t.txn_date_created),
        returnType: 'DEBIT_NOTE',
        grandTotal,
        refundStatus: Number(t.txn_cash_amount || 0) > 0 ? 'PAID' : 'PENDING',
        notes: t.txn_description || null,
      });
    }

    for (const chunk of chunkArray(purchaseReturnsData, 500)) {
      await prisma.purchaseReturn.createMany({ data: chunk });
    }

    const insertedPurchaseReturns = await prisma.purchaseReturn.findMany({
      where: { businessId },
      select: { id: true, returnNo: true },
    });
    const debitNoToId = new Map(insertedPurchaseReturns.map((r) => [r.returnNo, r.id]));

    const purchaseReturnRowsData = [];
    for (const t of debitNotes) {
      const dNo = txnToDebitNo.get(t.txn_id);
      const prId = debitNoToId.get(dNo);
      if (!prId) continue;

      const rows = lineitemsByTxn.get(t.txn_id) || [];
      for (const r of rows) {
        purchaseReturnRowsData.push({
          purchaseReturnId: prId,
          itemId: itemIdMap.get(r.item_id) || null,
          itemName: itemNameMap.get(r.item_id) || r.lineitem_description || 'Debit Product',
          qty: Number(r.quantity || 1),
          price: Number(r.priceperunit || 0),
          total: Number(r.total_amount || 0),
        });
      }
    }

    for (const chunk of chunkArray(purchaseReturnRowsData, 1000)) {
      await prisma.purchaseReturnRow.createMany({ data: chunk });
    }
    logger.info(`Imported ${purchaseReturnsData.length} purchase returns / debit notes`);

    // 16. Estimates (txn_type = 21) with Collision Avoidance
    const otherEstimates = await prisma.estimate.findMany({
      where: { businessId: { not: businessId } },
      select: { estimateNo: true },
    });
    const globallyUsedEstNos = new Set(otherEstimates.map((e) => e.estimateNo));
    const usedInBatchEstimates = new Set();

    const estimates = db
      .prepare('SELECT * FROM kb_transactions WHERE txn_type = 21 AND txn_status != 2 ORDER BY txn_id ASC')
      .all();
    const txnToEstNo = new Map();
    const estimatesData = [];

    for (const t of estimates) {
      const rawNo = (t.txn_ref_number_char || '').trim();
      let estimateNo = rawNo;

      if (!estimateNo || globallyUsedEstNos.has(estimateNo) || usedInBatchEstimates.has(estimateNo)) {
        estimateNo = rawNo ? `${rawNo}-${businessId}` : `EST-${businessId}-${t.txn_id}`;
        if (globallyUsedEstNos.has(estimateNo) || usedInBatchEstimates.has(estimateNo)) {
          estimateNo = `EST-${businessId}-${t.txn_id}`;
        }
      }
      usedInBatchEstimates.add(estimateNo);
      txnToEstNo.set(t.txn_id, estimateNo);

      const pId = partyIdMap.get(t.txn_name_id) || null;
      const pName = partyNameMap.get(t.txn_name_id) || 'Customer';
      const grandTotal = Number(t.txn_cash_amount || t.txn_balance_amount || 0);

      estimatesData.push({
        businessId,
        partyId: pId,
        partyName: pName,
        estimateNo,
        date: new Date(t.txn_date || t.txn_date_created),
        subtotal: grandTotal,
        grandTotal,
        termsText: t.txn_description || null,
      });
    }

    for (const chunk of chunkArray(estimatesData, 500)) {
      await prisma.estimate.createMany({ data: chunk });
    }

    const insertedEstimates = await prisma.estimate.findMany({
      where: { businessId },
      select: { id: true, estimateNo: true },
    });
    const estNoToId = new Map(insertedEstimates.map((e) => [e.estimateNo, e.id]));

    const estimateRowsData = [];
    for (const t of estimates) {
      const eNo = txnToEstNo.get(t.txn_id);
      const estId = estNoToId.get(eNo);
      if (!estId) continue;

      const rows = lineitemsByTxn.get(t.txn_id) || [];
      for (const r of rows) {
        estimateRowsData.push({
          estimateId: estId,
          itemId: itemIdMap.get(r.item_id) || null,
          itemName: itemNameMap.get(r.item_id) || r.lineitem_description || 'Product',
          qty: Number(r.quantity || 1),
          price: Number(r.priceperunit || 0),
          total: Number(r.total_amount || 0),
        });
      }
    }

    for (const chunk of chunkArray(estimateRowsData, 1000)) {
      await prisma.estimateRow.createMany({ data: chunk });
    }
    logger.info(`Imported ${estimatesData.length} estimates / quotations`);

    // 17. Delivery Challans (txn_type = 7) with Collision Avoidance
    const otherChallans = await prisma.deliveryChallan.findMany({
      where: { businessId: { not: businessId } },
      select: { challanNo: true },
    });
    const globallyUsedChallanNos = new Set(otherChallans.map((c) => c.challanNo));
    const usedInBatchChallans = new Set();

    const challans = db
      .prepare('SELECT * FROM kb_transactions WHERE txn_type = 7 AND txn_status != 2 ORDER BY txn_id ASC')
      .all();
    const txnToChallanNo = new Map();
    const challansData = [];

    for (const t of challans) {
      const rawNo = (t.txn_ref_number_char || '').trim();
      let challanNo = rawNo;

      if (!challanNo || globallyUsedChallanNos.has(challanNo) || usedInBatchChallans.has(challanNo)) {
        challanNo = rawNo ? `${rawNo}-${businessId}` : `DC-${businessId}-${t.txn_id}`;
        if (globallyUsedChallanNos.has(challanNo) || usedInBatchChallans.has(challanNo)) {
          challanNo = `DC-${businessId}-${t.txn_id}`;
        }
      }
      usedInBatchChallans.add(challanNo);
      txnToChallanNo.set(t.txn_id, challanNo);

      const pId = partyIdMap.get(t.txn_name_id) || null;
      const grandTotal = Number(t.txn_cash_amount || t.txn_balance_amount || 0);

      challansData.push({
        businessId,
        partyId: pId,
        challanNo,
        date: new Date(t.txn_date || t.txn_date_created),
        status: 'PENDING',
        grandTotal,
        notes: t.txn_description || null,
      });
    }

    if (challansData.length > 0) {
      await prisma.deliveryChallan.createMany({ data: challansData });
      const insertedChallans = await prisma.deliveryChallan.findMany({
        where: { businessId },
        select: { id: true, challanNo: true },
      });
      const challanNoToId = new Map(insertedChallans.map((c) => [c.challanNo, c.id]));

      const challanRowsData = [];
      for (const t of challans) {
        const cNo = txnToChallanNo.get(t.txn_id);
        const dcId = challanNoToId.get(cNo);
        if (!dcId) continue;

        const rows = lineitemsByTxn.get(t.txn_id) || [];
        for (const r of rows) {
          challanRowsData.push({
            deliveryChallanId: dcId,
            itemId: itemIdMap.get(r.item_id) || null,
            itemName: itemNameMap.get(r.item_id) || r.lineitem_description || 'Product',
            qty: Number(r.quantity || 1),
            price: Number(r.priceperunit || 0),
            total: Number(r.total_amount || 0),
          });
        }
      }
      if (challanRowsData.length > 0) {
        await prisma.deliveryChallanRow.createMany({ data: chunkArray(challanRowsData, 1000)[0] });
      }
    }

    // 18. Sales Orders (txn_type = 23) with Collision Avoidance
    const otherOrders = await prisma.salesOrder.findMany({
      where: { businessId: { not: businessId } },
      select: { orderNo: true },
    });
    const globallyUsedOrderNos = new Set(otherOrders.map((o) => o.orderNo));
    const usedInBatchOrders = new Set();

    const orders = db
      .prepare('SELECT * FROM kb_transactions WHERE txn_type = 23 AND txn_status != 2 ORDER BY txn_id ASC')
      .all();
    const txnToOrderNo = new Map();
    const ordersData = [];

    for (const t of orders) {
      const rawNo = (t.txn_ref_number_char || '').trim();
      let orderNo = rawNo;

      if (!orderNo || globallyUsedOrderNos.has(orderNo) || usedInBatchOrders.has(orderNo)) {
        orderNo = rawNo ? `${rawNo}-${businessId}` : `SO-${businessId}-${t.txn_id}`;
        if (globallyUsedOrderNos.has(orderNo) || usedInBatchOrders.has(orderNo)) {
          orderNo = `SO-${businessId}-${t.txn_id}`;
        }
      }
      usedInBatchOrders.add(orderNo);
      txnToOrderNo.set(t.txn_id, orderNo);

      const pId = partyIdMap.get(t.txn_name_id) || null;
      const grandTotal = Number(t.txn_cash_amount || 0) + Number(t.txn_balance_amount || 0);

      ordersData.push({
        businessId,
        partyId: pId,
        orderNo,
        date: new Date(t.txn_date || t.txn_date_created),
        status: 'PENDING',
        grandTotal,
        advanceAmount: Number(t.txn_cash_amount || 0),
      });
    }

    if (ordersData.length > 0) {
      await prisma.salesOrder.createMany({ data: ordersData });
      const insertedOrders = await prisma.salesOrder.findMany({
        where: { businessId },
        select: { id: true, orderNo: true },
      });
      const orderNoToId = new Map(insertedOrders.map((o) => [o.orderNo, o.id]));

      const orderRowsData = [];
      for (const t of orders) {
        const oNo = txnToOrderNo.get(t.txn_id);
        const soId = orderNoToId.get(oNo);
        if (!soId) continue;

        const rows = lineitemsByTxn.get(t.txn_id) || [];
        for (const r of rows) {
          orderRowsData.push({
            salesOrderId: soId,
            itemId: itemIdMap.get(r.item_id) || null,
            itemName: itemNameMap.get(r.item_id) || r.lineitem_description || 'Product',
            qty: Number(r.quantity || 1),
            price: Number(r.priceperunit || 0),
            total: Number(r.total_amount || 0),
          });
        }
      }
      if (orderRowsData.length > 0) {
        await prisma.salesOrderRow.createMany({ data: orderRowsData });
      }
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = {
      businessName: firm?.firm_name || 'R.A LIGHT',
      timeElapsedSeconds: Number(elapsedSeconds),
      counts: {
        parties: partyIdMap.size,
        items: itemIdMap.size,
        units: unitIdMap.size,
        categories: catIdMap.size,
        bankAccounts: bankIdMap.size,
        salesInvoices: salesInvoicesData.length,
        salesInvoiceRows: salesRowsData.length,
        purchaseInvoices: purchaseInvoicesData.length,
        purchaseInvoiceRows: purchaseRowsData.length,
        paymentsIn: payInRecords.length,
        paymentsOut: payOutRecords.length,
        paymentInAllocations: payInAllocations.length,
        paymentOutAllocations: payOutAllocations.length,
        salesReturns: salesReturnsData.length,
        purchaseReturns: purchaseReturnsData.length,
        estimates: estimatesData.length,
        deliveryChallans: challansData.length,
        salesOrders: ordersData.length,
      },
    };

    logger.info(`Vyapar database import completed successfully in ${elapsedSeconds}s!`, summary);
    return summary;
  } finally {
    db.close();
  }
};

export default {
  resolveSqlitePath,
  importVyaparBackup,
};
