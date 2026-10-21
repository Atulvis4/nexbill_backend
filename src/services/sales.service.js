import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';
import auditService from './audit.service.js';

// Helper to generate document numbers dynamically and increment next count
const generateDocNo = async (tx, businessId, type) => {
  const business = await tx.business.findUnique({ where: { id: businessId } });
  if (!business) throw new Error('Business not found');

  let prefix;
  let nextVal;

  switch (type) {
    case 'sales':
      prefix = business.numberingSalesPrefix || `INV-${businessId}-`;
      nextVal = business.numberingSalesNext;
      break;
    case 'estimate':
      prefix = business.numberingEstimatePrefix || `EST-${businessId}-`;
      nextVal = business.numberingEstimateNext;
      break;
    case 'challan':
      prefix = business.numberingChallanPrefix || `CHL-${businessId}-`;
      nextVal = business.numberingChallanNext;
      break;
    case 'order':
      prefix = business.numberingOrderPrefix || `ORD-${businessId}-`;
      nextVal = business.numberingOrderNext;
      break;
    case 'return':
      prefix = business.numberingReturnPrefix || `RET-${businessId}-`;
      nextVal = business.numberingReturnNext;
      break;
    case 'receipt':
      prefix = business.numberingReceiptPrefix || `RCP-${businessId}-`;
      nextVal = business.numberingReceiptNext;
      break;
    case 'paymentOut':
      prefix = business.numberingPaymentOutPrefix || `POUT-${businessId}-`;
      nextVal = business.numberingPaymentOutNext;
      break;
    default:
      prefix = `DOC-${businessId}-`;
      nextVal = 1;
  }

  let generatedNo;
  let exists = true;
  while (exists) {
    generatedNo = `${prefix}${nextVal}`;
    exists = false;

    if (type === 'sales') {
      const rec = await tx.salesInvoice.findUnique({ where: { invoiceNo: generatedNo } });
      if (rec) exists = true;
    } else if (type === 'estimate') {
      const rec = await tx.estimate.findUnique({ where: { estimateNo: generatedNo } });
      if (rec) exists = true;
    } else if (type === 'challan') {
      const rec = await tx.deliveryChallan.findUnique({ where: { challanNo: generatedNo } });
      if (rec) exists = true;
    } else if (type === 'order') {
      const rec = await tx.salesOrder.findUnique({ where: { orderNo: generatedNo } });
      if (rec) exists = true;
    } else if (type === 'return') {
      const rec = await tx.salesReturn.findUnique({ where: { returnNo: generatedNo } });
      if (rec) exists = true;
    } else if (type === 'receipt') {
      const rec = await tx.paymentIn.findUnique({ where: { receiptNo: generatedNo } });
      if (rec) exists = true;
    } else if (type === 'paymentOut') {
      const rec = await tx.paymentOut.findUnique({ where: { paymentNo: generatedNo } });
      if (rec) exists = true;
    }

    if (exists) {
      nextVal++;
    }
  }

  let updateField = {};
  switch (type) {
    case 'sales': updateField = { numberingSalesNext: nextVal + 1 }; break;
    case 'estimate': updateField = { numberingEstimateNext: nextVal + 1 }; break;
    case 'challan': updateField = { numberingChallanNext: nextVal + 1 }; break;
    case 'order': updateField = { numberingOrderNext: nextVal + 1 }; break;
    case 'return': updateField = { numberingReturnNext: nextVal + 1 }; break;
    case 'receipt': updateField = { numberingReceiptNext: nextVal + 1 }; break;
    case 'paymentOut': updateField = { numberingPaymentOutNext: nextVal + 1 }; break;
  }

  if (Object.keys(updateField).length > 0) {
    await tx.business.update({
      where: { id: businessId },
      data: updateField,
    });
  }

  return generatedNo;
};

// Helper to resolve or auto-create a party by name or phone
const resolveOrCreateParty = async (tx, businessId, partyId, partyName, phone, stateOfSupply) => {
  if (partyId) {
    return partyId;
  }
  if (!partyName) {
    return null;
  }
  const cleanName = partyName.trim();
  const defaultNames = ['cash customer', 'walk-in customer', 'cash supplier'];
  if (!cleanName || defaultNames.includes(cleanName.toLowerCase())) {
    return null;
  }

  // Look up by name or phone
  let party = await tx.party.findFirst({
    where: {
      businessId,
      OR: [
        { partyName: cleanName },
        phone ? { phone: phone.trim() } : null,
      ].filter(Boolean),
      isArchived: false,
    },
  });

  if (!party) {
    party = await tx.party.create({
      data: {
        businessId,
        partyName: cleanName,
        phone: phone || '',
        state: stateOfSupply || 'Maharashtra',
        openingBalance: 0,
        balanceType: 'RECEIVABLE',
      },
    });
  }
  return party.id;
};

// =========================================================================
// BATCH RESOLVE ITEMS & UNITS
// Resolves or auto-creates items and looks up unit multipliers for all
// invoice rows in bulk (1–2 queries instead of N per row).
//
// Returns:
//   resolvedRows — enriched copies of each row with itemId, itemName, unit,
//                  unitMultiplier, hsn, taxRate filled in from the DB record
//                  (frontend values are kept as fallback when DB has none).
//   itemById     — Map<itemId, item> for use in stock-movement logic below.
// =========================================================================
const batchResolveItemsAndUnits = async (tx, businessId, rows) => {
  // ── 1. Separate rows that already have an itemId from name-only rows ──
  const existingIds = [...new Set(rows.filter((r) => r.itemId).map((r) => r.itemId))];
  const nameOnlyRows = rows.filter((r) => !r.itemId && r.itemName);

  // ── 2. Fetch all existing items in one query ──
  const fetchedItems = existingIds.length
    ? await tx.item.findMany({
        where: { id: { in: existingIds }, businessId },
        include: { unit: true },
      })
    : [];

  const itemById = new Map(fetchedItems.map((item) => [item.id, item]));

  // ── 3. Resolve name-only rows — look up or auto-create each unique name ──
  for (const r of nameOnlyRows) {
    const cleanName = r.itemName.trim();
    if (!cleanName) continue;

    let item = await tx.item.findFirst({
      where: { businessId, name: cleanName, isArchived: false },
      include: { unit: true },
    });

    if (!item) {
      // Auto-create a minimal SERVICE item so the invoice can be saved
      item = await tx.item.create({
        data: {
          businessId,
          name: cleanName,
          type: 'SERVICE',
          hsn: r.hsn || '',
          salePrice: Number(r.price) || 0,
          taxRate: Number(r.taxRate) || 0,
        },
        include: { unit: true },
      });
    }

    // Attach the resolved itemId back onto the row object (mutate working copy)
    r.itemId = item.id;
    itemById.set(item.id, item);
  }

  // ── 4. Collect all unique unit names from rows that have no itemId unit ──
  //      so we can do a single unit lookup for multipliers.
  const unitNames = [
    ...new Set(
      rows
        .filter((r) => r.unit && !itemById.get(r.itemId)?.unit)
        .map((r) => r.unit.trim())
        .filter(Boolean)
    ),
  ];

  const fetchedUnits = unitNames.length
    ? await tx.unit.findMany({
        where: { businessId, name: { in: unitNames } },
      })
    : [];

  const unitByName = new Map(fetchedUnits.map((u) => [u.name, u]));

  // ── 5. Build enriched resolvedRows ──
  const resolvedRows = rows.map((r) => {
    const item = r.itemId ? itemById.get(r.itemId) : null;
    const itemUnit = item?.unit ?? null;
    const lookedUpUnit = r.unit ? unitByName.get(r.unit.trim()) : null;

    // Prefer DB-sourced multiplier; fall back to row value or 1
    const unitMultiplier =
      Number(itemUnit?.multiplier) ||
      Number(lookedUpUnit?.multiplier) ||
      Number(r.unitMultiplier) ||
      1;

    return {
      ...r,
      itemId: r.itemId ?? null,
      itemName: r.itemName ?? item?.name ?? '',
      hsn: r.hsn ?? item?.hsn ?? '',
      unit: r.unit ?? itemUnit?.name ?? '',
      unitMultiplier,
      taxRate: r.taxRate ?? Number(item?.taxRate) ?? 0,
      // Keep a reference to the full item object for stock logic
      _item: item,
    };
  });

  return { resolvedRows, itemById };
};

// =========================================================================
// SALES INVOICES
// =========================================================================

const createInvoice = async (businessId, data) => {
  const { rows, paid: rawPaid, bankAccountId, previousBalancePaid, ...invoiceData } = data;

  return await prisma.$transaction(async (tx) => {
    // Resolve or auto-create party if partyName is provided
    invoiceData.partyId = await resolveOrCreateParty(
      tx,
      businessId,
      invoiceData.partyId,
      invoiceData.partyName,
      invoiceData.phone,
      invoiceData.stateOfSupply
    );

    if (invoiceData.invoiceNo) {
      const existing = await tx.salesInvoice.findUnique({
        where: { invoiceNo: invoiceData.invoiceNo },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, `Invoice number '${invoiceData.invoiceNo}' already exists`);
      }
    }
    const invoiceNo = invoiceData.invoiceNo || (await generateDocNo(tx, businessId, 'sales'));

    // Batch resolve or create items/units in 1-2 queries total
    const { resolvedRows, itemById } = await batchResolveItemsAndUnits(tx, businessId, rows);

    // Clamp paid to [0, grandTotal] — backend is the source of truth
    const safePaid = Math.min(Math.max(Number(rawPaid) || 0, 0), Number(invoiceData.grandTotal));
    const safeBalance = Number(invoiceData.grandTotal) - safePaid;

    // Create the Invoice
    const invoice = await tx.salesInvoice.create({
      data: {
        ...invoiceData,
        invoiceNo,
        businessId,
        subtotal: invoiceData.subtotal,
        discountValue: invoiceData.discountValue || 0,
        discountIsPercentage: invoiceData.discountIsPercentage || false,
        cgst: invoiceData.cgst,
        sgst: invoiceData.sgst,
        igst: invoiceData.igst,
        totalTax: invoiceData.totalTax,
        grandTotal: invoiceData.grandTotal,
        paid: safePaid,
        balance: safeBalance,
        roundOff: invoiceData.roundOff || 0,
        previousBalance: invoiceData.previousBalance !== undefined ? invoiceData.previousBalance : null,
        rows: {
          create: resolvedRows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn,
            qty: r.qty,
            unit: r.unit,
            unitMultiplier: Number(r.unitMultiplier) || 1,
            price: r.price,
            discountValue: r.discountValue,
            discountIsPercentage: r.discountIsPercentage,
            taxRate: r.taxRate,
            taxAmount: r.taxAmount,
            total: r.total,
            box: r.box ?? null,
          })),
        },
      },
      include: { rows: true },
    });

    // Stock movements & ledger using cached item map
    const stockLedgerEntries = [];
    for (const r of resolvedRows) {
      if (r.itemId) {
        const item = r._item || itemById.get(r.itemId);
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;
          const adjustmentVal = baseQty * Number(item.purchasePrice || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal - adjustmentVal;

          // Deduct stock and stock value by base quantity/cost
          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { decrement: baseQty },
              stockValue: newVal,
            },
          });

          stockLedgerEntries.push({
            businessId,
            itemId: r.itemId,
            type: 'OUT',
            quantity: baseQty,
            adjustedValue: adjustmentVal,
            description: `Sales Invoice ${invoiceNo}`,
            referenceType: 'SALES_INVOICE',
            referenceId: invoice.id,
          });
        }
      }
    }

    if (stockLedgerEntries.length > 0) {
      await tx.stockLedger.createMany({ data: stockLedgerEntries });
    }

    // Payment recording if paid > 0 (against current invoice)
    if (safePaid > 0) {
      const receiptNo = await generateDocNo(tx, businessId, 'receipt');

      const payment = await tx.paymentIn.create({
        data: {
          businessId,
          partyId: invoiceData.partyId,
          bankAccountId: bankAccountId || null,
          receiptNo,
          date: invoiceData.date,
          receivedAmount: safePaid,
          paymentMode: bankAccountId ? 'BANK' : 'CASH',
          description: `Auto-payment for Invoice ${invoiceNo}`,
        },
      });

      // Allocate payment
      await tx.paymentInAllocation.create({
        data: {
          paymentInId: payment.id,
          invoiceId: invoice.id,
          amount: safePaid,
        },
      });

      // Update bank account balance if applicable
      if (bankAccountId) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            currentBalance: { increment: safePaid },
          },
        });

        await tx.bankingTransaction.create({
          data: {
            businessId,
            bankAccountId,
            date: invoiceData.date,
            type: 'DEPOSIT',
            amount: safePaid,
            description: `Payment for Invoice ${invoiceNo}`,
          },
        });
      }
    }

    // ── Previous Balance Payment: allocate against old open invoices (FIFO) ──
    // This ensures the "previous balance" shown on the invoice printout is
    // actually cleared in the ledger and does NOT double-count with new invoice.
    const rawPrevBalancePaid = Number(previousBalancePaid) || 0;
    const safePrevBalancePaid = Math.max(0, rawPrevBalancePaid);

    if (safePrevBalancePaid > 0 && invoiceData.partyId) {
      // Fetch all open invoices for this party, oldest first (FIFO), excluding the one just created
      const openInvoices = await tx.salesInvoice.findMany({
        where: {
          businessId,
          partyId: invoiceData.partyId,
          balance: { gt: 0 },
          isArchived: false,
          id: { not: invoice.id }, // exclude the invoice just created
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      });

      if (openInvoices.length > 0) {
        const prevReceiptNo = await generateDocNo(tx, businessId, 'receipt');

        const prevPayment = await tx.paymentIn.create({
          data: {
            businessId,
            partyId: invoiceData.partyId,
            bankAccountId: bankAccountId || null,
            receiptNo: prevReceiptNo,
            date: invoiceData.date,
            receivedAmount: safePrevBalancePaid,
            paymentMode: bankAccountId ? 'BANK' : 'CASH',
            description: `Previous balance payment collected with Invoice ${invoiceNo}`,
          },
        });

        // FIFO waterfall allocation across old open invoices
        let remaining = safePrevBalancePaid;
        for (const oldInv of openInvoices) {
          if (remaining <= 0) break;
          const invBalance = Number(oldInv.balance);
          const alloc = Math.min(remaining, invBalance);
          if (alloc <= 0) continue;

          await tx.paymentInAllocation.create({
            data: {
              paymentInId: prevPayment.id,
              invoiceId: oldInv.id,
              amount: alloc,
            },
          });

          await tx.salesInvoice.update({
            where: { id: oldInv.id },
            data: {
              paid: { increment: alloc },
              balance: { decrement: alloc },
            },
          });

          remaining -= alloc;
        }

        // Update bank account for previous balance payment if applicable
        if (bankAccountId) {
          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: { currentBalance: { increment: safePrevBalancePaid } },
          });

          await tx.bankingTransaction.create({
            data: {
              businessId,
              bankAccountId,
              date: invoiceData.date,
              type: 'DEPOSIT',
              amount: safePrevBalancePaid,
              description: `Previous balance collected with Invoice ${invoiceNo}`,
            },
          });
        }
      }
    }

    return invoice;
  });
};


const listInvoices = async (businessId, search, fromDate, toDate, partyId) => {
  const where = {
    businessId,
    isArchived: false,
  };

  if (partyId) {
    where.partyId = parseInt(partyId, 10);
  }

  if (search) {
    where.OR = [
      { invoiceNo: { contains: search } },
      { partyName: { contains: search } },
    ];
  }

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(fromDate);
    if (toDate) where.date.lte = new Date(toDate);
  }

  return await prisma.salesInvoice.findMany({
    where,
    include: { rows: true },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
  });
};

const getInvoice = async (businessId, id) => {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, businessId, isArchived: false },
    include: {
      rows: true,
      allocations: {
        include: { paymentIn: true },
      },
    },
  });

  if (!invoice) throw new ApiError(httpStatus.NOT_FOUND, 'Invoice not found');
  return invoice;
};

const deleteInvoice = async (businessId, id) => {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, businessId, isArchived: false },
  });

  if (!invoice) throw new ApiError(httpStatus.NOT_FOUND, 'Invoice not found');

  await prisma.salesInvoice.update({
    where: { id },
    data: {
      isArchived: true,
      deletedAt: new Date(),
    },
  });

  return { success: true };
};

const deletePaymentIn = async (businessId, id) => {
  const payment = await prisma.paymentIn.findFirst({
    where: { id, businessId },
  });

  if (!payment) throw new ApiError(httpStatus.NOT_FOUND, 'Payment receipt not found');

  return await prisma.$transaction(async (tx) => {
    await tx.paymentInAllocation.deleteMany({ where: { paymentInId: id } });
    await tx.paymentIn.delete({ where: { id } });
    return { success: true };
  });
};

const deleteReturn = async (businessId, id) => {
  const sreturn = await prisma.salesReturn.findFirst({
    where: { id, businessId },
  });

  if (!sreturn) throw new ApiError(httpStatus.NOT_FOUND, 'Sales return credit note not found');

  return await prisma.$transaction(async (tx) => {
    await tx.salesReturnRow.deleteMany({ where: { salesReturnId: id } });
    await tx.salesReturn.delete({ where: { id } });
    return { success: true };
  });
};

const listDeletedInvoices = async (businessId) => {
  return await prisma.salesInvoice.findMany({
    where: { businessId, isArchived: true },
    include: { rows: true },
    orderBy: { deletedAt: 'desc' },
  });
};

// =========================================================================
// ESTIMATES / QUOTATIONS
// =========================================================================

const createEstimate = async (businessId, data) => {
  const { rows, ...estData } = data;

  return await prisma.$transaction(async (tx) => {
    // Resolve or auto-create party
    const resolvedPartyId = await resolveOrCreateParty(
      tx,
      businessId,
      estData.partyId,
      estData.partyName,
      estData.phone,
      estData.stateOfSupply
    );
    estData.partyId = resolvedPartyId;

    if (estData.estimateNo) {
      const existing = await tx.estimate.findUnique({
        where: { estimateNo: estData.estimateNo },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, `Estimate number '${estData.estimateNo}' already exists`);
      }
    }
    const estimateNo = estData.estimateNo || (await generateDocNo(tx, businessId, 'estimate'));

    return await tx.estimate.create({
      data: {
        ...estData,
        estimateNo,
        businessId,
        rows: {
          create: rows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn,
            qty: r.qty,
            unit: r.unit,
            price: r.price,
            discountValue: r.discountValue,
            discountIsPercentage: r.discountIsPercentage,
            taxRate: r.taxRate,
            taxAmount: r.taxAmount,
            total: r.total,
            box: r.box ?? null,
          })),
        },
      },
      include: { rows: true, party: true },
    });
  });
};

const listEstimates = async (businessId) => {
  return await prisma.estimate.findMany({
    where: { businessId, isArchived: false },
    include: { rows: true, party: true },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
  });
};

const deleteEstimate = async (businessId, id) => {
  const est = await prisma.estimate.findFirst({ where: { id, businessId } });
  if (!est) throw new ApiError(httpStatus.NOT_FOUND, 'Estimate not found');

  await prisma.estimate.update({
    where: { id },
    data: { isArchived: true },
  });
  return { success: true };
};

const convertEstimateToInvoice = async (businessId, estimateId) => {
  const est = await prisma.estimate.findFirst({
    where: { id: estimateId, businessId, isArchived: false, isConverted: false },
    include: { rows: true },
  });

  if (!est) throw new ApiError(httpStatus.BAD_REQUEST, 'Estimate not found or already converted');

  const invoiceData = {
    date: new Date().toISOString(),
    partyId: est.partyId,
    partyName: est.partyName,
    phone: est.phone,
    stateOfSupply: est.stateOfSupply,
    isCash: false,
    subtotal: est.subtotal,
    grandTotal: est.grandTotal,
    paid: 0,
    balance: est.grandTotal,
    rows: est.rows,
  };

  const invoice = await createInvoice(businessId, invoiceData);

  await prisma.estimate.update({
    where: { id: estimateId },
    data: {
      isConverted: true,
      convertedInvoiceId: invoice.id,
    },
  });

  return invoice;
};

// =========================================================================
// PAYMENTS IN (FIFO WATERFALL ALLOCATION)
// =========================================================================

const createPaymentIn = async (businessId, data) => {
  return await prisma.$transaction(async (tx) => {
    if (data.receiptNo) {
      const existing = await tx.paymentIn.findUnique({
        where: { receiptNo: data.receiptNo },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, `Receipt number '${data.receiptNo}' already exists`);
      }
    }
    const receiptNo = data.receiptNo || (await generateDocNo(tx, businessId, 'receipt'));

    const payment = await tx.paymentIn.create({
      data: {
        businessId,
        partyId: data.partyId,
        bankAccountId: data.bankAccountId || null,
        receiptNo,
        date: new Date(data.date),
        receivedAmount: data.receivedAmount,
        paymentMode: data.paymentMode,
        referenceNo: data.referenceNo,
        description: data.description,
      },
    });

    // Update bank balance if bankAccountId is provided
    if (data.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { currentBalance: { increment: data.receivedAmount } },
      });

      await tx.bankingTransaction.create({
        data: {
          businessId,
          bankAccountId: data.bankAccountId,
          date: new Date(data.date),
          type: 'DEPOSIT',
          amount: data.receivedAmount,
          description: `Payment In receipt ${receiptNo}`,
        },
      });
    }

    // Allocate payment using specific allocations OR FIFO waterfall
    if (data.partyId) {
      if (data.allocations && data.allocations.length > 0) {
        for (const alloc of data.allocations) {
          const invoiceId = Number(alloc.invoiceId);
          const allocationAmount = Number(alloc.amount);
          if (allocationAmount <= 0) continue;

          // Verify invoice exists and has enough balance
          const inv = await tx.salesInvoice.findFirst({
            where: { id: invoiceId, partyId: data.partyId, isArchived: false },
          });
          if (!inv) continue;

          const actualAllocation = Math.min(allocationAmount, Number(inv.balance));
          if (actualAllocation <= 0) continue;

          // Record allocation
          await tx.paymentInAllocation.create({
            data: {
              paymentInId: payment.id,
              invoiceId,
              amount: actualAllocation,
            },
          });

          // Update invoice
          await tx.salesInvoice.update({
            where: { id: invoiceId },
            data: {
              paid: { increment: actualAllocation },
              balance: { decrement: actualAllocation },
            },
          });
        }
      } else {
        const openInvoices = await tx.salesInvoice.findMany({
          where: {
            businessId,
            partyId: data.partyId,
            balance: { gt: 0 },
            isArchived: false,
          },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        });

        let remaining = Number(data.receivedAmount);
        for (const inv of openInvoices) {
          if (remaining <= 0) break;

          const invBalance = Number(inv.balance);
          const allocationAmount = Math.min(remaining, invBalance);
          if (allocationAmount <= 0) continue;

          // Record allocation
          await tx.paymentInAllocation.create({
            data: {
              paymentInId: payment.id,
              invoiceId: inv.id,
              amount: allocationAmount,
            },
          });

          // Update invoice
          await tx.salesInvoice.update({
            where: { id: inv.id },
            data: {
              paid: { increment: allocationAmount },
              balance: { decrement: allocationAmount },
            },
          });

          remaining -= allocationAmount;
        }
      }
    }

    return payment;
  });
};

const listPaymentsIn = async (businessId) => {
  return await prisma.paymentIn.findMany({
    where: { businessId },
    include: { allocations: { include: { invoice: true } }, party: true },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
  });
};

// =========================================================================
// SALES RETURNS / CREDIT NOTES
// =========================================================================

const createReturn = async (businessId, data) => {
  const { rows, isCashRefund, ...returnData } = data;

  return await prisma.$transaction(async (tx) => {
    // Resolve or auto-create party
    const resolvedPartyId = await resolveOrCreateParty(
      tx,
      businessId,
      returnData.partyId,
      returnData.partyName,
      returnData.phone,
      null
    );
    returnData.partyId = resolvedPartyId;

    if (returnData.returnNo) {
      const existing = await tx.salesReturn.findUnique({
        where: { returnNo: returnData.returnNo },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, `Return number '${returnData.returnNo}' already exists`);
      }
    }
    const returnNo = returnData.returnNo || (await generateDocNo(tx, businessId, 'return'));

    const sreturn = await tx.salesReturn.create({
      data: {
        ...returnData,
        returnNo,
        businessId,
        date: new Date(returnData.date),
        grandTotal: returnData.grandTotal,
        refundStatus: isCashRefund ? 'PAID' : 'PENDING',
        rows: {
          create: rows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn,
            qty: r.qty,
            unit: r.unit,
            price: r.price,
            discountValue: r.discountValue,
            discountIsPercentage: r.discountIsPercentage,
            taxRate: r.taxRate,
            taxAmount: r.taxAmount,
            total: r.total,
            box: r.box ?? null,
          })),
        },
      },
      include: { rows: true, party: true },
    });

    // Restock returned items: DO NOT add to product stock (as per requirement)
    for (const r of rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          // Do not increment stockQuantity and do not create stock ledger IN transaction
          /*
          await tx.item.update({
            where: { id: r.itemId },
            data: { stockQuantity: { increment: r.qty } },
          });

          await tx.stockLedger.create({
            data: {
              businessId,
              itemId: r.itemId,
              type: 'IN',
              quantity: r.qty,
              description: `Sales Return ${returnNo}`,
              referenceType: 'SALES_RETURN',
              referenceId: sreturn.id,
            },
          });
          */
        }
      }
    }

    // Ledger adjustments: If CASH return refund, we subtract from Cash bank balance
    if (returnData.returnType === 'REPLACEMENT') {
      // Replaced item - handled via restocking. Replacement items sent out should deduct stock, but typically managed inside invoice/exchange.
    } else if (returnData.returnType === 'CREDIT_NOTE' && returnData.originalInvoiceId) {
      const invoice = await tx.salesInvoice.findUnique({
        where: { id: returnData.originalInvoiceId }
      });
      if (invoice) {
        const applyAmount = Math.min(Number(invoice.balance), Number(sreturn.grandTotal));
        if (applyAmount > 0) {
          await tx.salesInvoice.update({
            where: { id: invoice.id },
            data: {
              paid: { increment: applyAmount },
              balance: { decrement: applyAmount },
            }
          });
        }
      }
    }

    // Record automatic cash refund payment out if immediate cash refund is selected
    if (isCashRefund) {
      const payoutNo = await generateDocNo(tx, businessId, 'paymentOut');
      await tx.paymentOut.create({
        data: {
          businessId,
          partyId: returnData.partyId,
          bankAccountId: null,
          paymentNo: payoutNo,
          date: new Date(returnData.date),
          amount: returnData.grandTotal,
          paymentMode: 'CASH',
          description: `Cash refund for Sales Return ${returnNo}`,
          salesReturnId: sreturn.id,
        },
      });
    }

    return sreturn;
  });
};

const listReturns = async (businessId) => {
  return await prisma.salesReturn.findMany({
    where: { businessId },
    include: { rows: true, party: true, paymentsOut: { select: { id: true, paymentNo: true, amount: true } } },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
  });
};

// =========================================================================
// DELIVERY CHALLANS
// =========================================================================

const createChallan = async (businessId, data) => {
  const { rows, ...chalData } = data;

  return await prisma.$transaction(async (tx) => {
    // Resolve or auto-create party
    const resolvedPartyId = await resolveOrCreateParty(
      tx,
      businessId,
      chalData.partyId,
      chalData.partyName,
      chalData.phone,
      chalData.stateOfSupply
    );
    chalData.partyId = resolvedPartyId;

    if (chalData.challanNo) {
      const existing = await tx.deliveryChallan.findUnique({
        where: { challanNo: chalData.challanNo },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, `Challan number '${chalData.challanNo}' already exists`);
      }
    }
    const challanNo = chalData.challanNo || (await generateDocNo(tx, businessId, 'challan'));

    const challan = await tx.deliveryChallan.create({
      data: {
        ...chalData,
        challanNo,
        businessId,
        grandTotal: chalData.grandTotal,
        rows: {
          create: rows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn,
            qty: r.qty,
            unit: r.unit,
            unitMultiplier: Number(r.unitMultiplier) || 1,
            price: r.price,
            discountValue: r.discountValue,
            discountIsPercentage: r.discountIsPercentage,
            taxRate: r.taxRate,
            taxAmount: r.taxAmount,
            total: r.total,
            box: r.box ?? null,
          })),
        },
      },
      include: { rows: true, party: true },
    });

    // Deduct stock for challan dispatch (with unit conversion snapshot)
    for (const r of rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;
          const adjustmentVal = baseQty * Number(item.purchasePrice || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal - adjustmentVal;

          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { decrement: baseQty },
              stockValue: newVal,
            },
          });

          await tx.stockLedger.create({
            data: {
              businessId,
              itemId: r.itemId,
              type: 'OUT',
              quantity: baseQty,
              adjustedValue: adjustmentVal,
              description: `Challan Dispatch ${challanNo}`,
              referenceType: 'DELIVERY_CHALLAN',
              referenceId: challan.id,
            },
          });
        }
      }
    }

    return challan;
  });
};

const listChallans = async (businessId) => {
  return await prisma.deliveryChallan.findMany({
    where: { businessId },
    include: { rows: true, party: true },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
  });
};

const updateChallanStatus = async (businessId, id, status) => {
  const challan = await prisma.deliveryChallan.findFirst({ where: { id, businessId } });
  if (!challan) throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');

  return await prisma.deliveryChallan.update({
    where: { id },
    data: { status },
  });
};

const convertChallanToInvoice = async (businessId, challanId) => {
  const challan = await prisma.deliveryChallan.findFirst({
    where: { id: challanId, businessId, status: 'PENDING' },
    include: { rows: true },
  });

  if (!challan) throw new ApiError(httpStatus.BAD_REQUEST, 'Challan not found or already billed');

  return await prisma.$transaction(async (tx) => {
    // Generate invoice
    const invoiceNo = await generateDocNo(tx, businessId, 'sales');

    const invoice = await tx.salesInvoice.create({
      data: {
        invoiceNo,
        businessId,
        date: new Date(),
        partyId: challan.partyId,
        partyName: `Challan Customer (${challan.challanNo})`,
        isCash: false,
        subtotal: challan.grandTotal,
        grandTotal: challan.grandTotal,
        paid: 0,
        balance: challan.grandTotal,
        rows: {
          create: challan.rows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn,
            qty: r.qty,
            unit: r.unit,
            price: r.price,
            discountValue: r.discountValue,
            discountIsPercentage: r.discountIsPercentage,
            taxRate: r.taxRate,
            taxAmount: r.taxAmount,
            total: r.total,
            box: r.box ?? null,
          })),
        },
      },
    });

    // Update status
    await tx.deliveryChallan.update({
      where: { id: challanId },
      data: {
        status: 'CONVERTED',
        convertedInvoiceId: invoice.id,
      },
    });

    return invoice;
  });
};

// =========================================================================
// SALES ORDERS
// =========================================================================

const createOrder = async (businessId, data) => {
  const { rows, bankAccountId, ...orderData } = data;

  return await prisma.$transaction(async (tx) => {
    // Resolve or auto-create party
    const resolvedPartyId = await resolveOrCreateParty(
      tx,
      businessId,
      orderData.partyId,
      orderData.partyName,
      orderData.phone,
      orderData.stateOfSupply
    );
    orderData.partyId = resolvedPartyId;

    if (orderData.orderNo) {
      const existing = await tx.salesOrder.findUnique({
        where: { orderNo: orderData.orderNo },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, `Order number '${orderData.orderNo}' already exists`);
      }
    }
    const orderNo = orderData.orderNo || (await generateDocNo(tx, businessId, 'order'));

    const order = await tx.salesOrder.create({
      data: {
        ...orderData,
        orderNo,
        businessId,
        date: new Date(orderData.date),
        expectedDeliveryDate: orderData.expectedDeliveryDate ? new Date(orderData.expectedDeliveryDate) : null,
        advanceAmount: orderData.advanceAmount || 0,
        grandTotal: orderData.grandTotal,
        rows: {
          create: rows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn,
            qty: r.qty,
            unit: r.unit,
            unitMultiplier: Number(r.unitMultiplier) || 1,
            price: r.price,
            discountValue: r.discountValue,
            discountIsPercentage: r.discountIsPercentage,
            taxRate: r.taxRate,
            taxAmount: r.taxAmount,
            total: r.total,
            box: r.box ?? null,
          })),
        },
      },
      include: { rows: true, party: true },
    });

    // Increment allocatedStock (in base units using multiplier snapshot)
    for (const r of rows) {
      if (r.itemId) {
        const multiplier = Number(r.unitMultiplier) || 1;
        const baseQty = Number(r.qty) * multiplier;
        await tx.item.update({
          where: { id: r.itemId },
          data: { allocatedStock: { increment: baseQty } },
        });
      }
    }

    // Handle advance payment
    if (orderData.advanceAmount > 0) {
      const receiptNo = await generateDocNo(tx, businessId, 'receipt');

      await tx.paymentIn.create({
        data: {
          businessId,
          partyId: orderData.partyId,
          bankAccountId: bankAccountId || null,
          receiptNo,
          date: new Date(orderData.date),
          receivedAmount: orderData.advanceAmount,
          paymentMode: orderData.advancePaymentMode || 'CASH',
          description: `Advance for Sales Order ${orderNo}`,
        },
      });

      if (bankAccountId) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: { currentBalance: { increment: orderData.advanceAmount } },
        });

        await tx.bankingTransaction.create({
          data: {
            businessId,
            bankAccountId,
            date: new Date(orderData.date),
            type: 'DEPOSIT',
            amount: orderData.advanceAmount,
            description: `Advance Payment for Sales Order ${orderNo}`,
          },
        });
      }
    }

    return order;
  });
};

const listOrders = async (businessId) => {
  return await prisma.salesOrder.findMany({
    where: { businessId },
    include: { rows: true, party: true },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
  });
};

const updateOrderStatus = async (businessId, id, status) => {
  const order = await prisma.salesOrder.findFirst({ where: { id, businessId } });
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Sales Order not found');

  return await prisma.salesOrder.update({
    where: { id },
    data: { status },
  });
};

const convertOrderToInvoice = async (businessId, orderId) => {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, businessId, status: 'PENDING' },
    include: { rows: true },
  });

  if (!order) throw new ApiError(httpStatus.BAD_REQUEST, 'Order not found or not in pending status');

  return await prisma.$transaction(async (tx) => {
    // Generate invoice
    const invoiceNo = await generateDocNo(tx, businessId, 'sales');

    const invoice = await tx.salesInvoice.create({
      data: {
        invoiceNo,
        businessId,
        date: new Date(),
        partyId: order.partyId,
        partyName: `Order Customer (${order.orderNo})`,
        isCash: false,
        subtotal: order.grandTotal,
        grandTotal: order.grandTotal,
        paid: order.advanceAmount, // Advance is already paid
        balance: Number(order.grandTotal) - Number(order.advanceAmount),
        rows: {
          create: order.rows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn,
            qty: r.qty,
            unit: r.unit,
            unitMultiplier: Number(r.unitMultiplier) || 1,
            price: r.price,
            discountValue: r.discountValue,
            discountIsPercentage: r.discountIsPercentage,
            taxRate: r.taxRate,
            taxAmount: r.taxAmount,
            total: r.total,
            box: r.box ?? null,
          })),
        },
      },
    });

    // Deduct stock, decrement allocated stock (using unit conversion snapshot)
    for (const r of order.rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;
          const adjustmentVal = baseQty * Number(item.purchasePrice || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal - adjustmentVal;

          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { decrement: baseQty },
              allocatedStock: { decrement: baseQty },
              stockValue: newVal,
            },
          });

          await tx.stockLedger.create({
            data: {
              businessId,
              itemId: r.itemId,
              type: 'OUT',
              quantity: baseQty,
              adjustedValue: adjustmentVal,
              description: `Invoice generated from Order ${order.orderNo}`,
              referenceType: 'SALES_INVOICE',
              referenceId: invoice.id,
            },
          });
        }
      }
    }

    // Update status
    await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        convertedInvoiceId: invoice.id,
      },
    });

    return invoice;
  });
};

const updateInvoice = async (businessId, id, data, userId) => {
  const oldInvoice = await prisma.salesInvoice.findFirst({
    where: { id, businessId, isArchived: false },
    include: { rows: true },
  });
  if (!oldInvoice) throw new ApiError(httpStatus.NOT_FOUND, 'Invoice not found');

  const { rows: newRowsData, paid, bankAccountId, previousBalancePaid, ...invoiceUpdateFields } = data;

  return await prisma.$transaction(async (tx) => {
    // 1. Revert old stock changes
    const oldItemIds = [...new Set(oldInvoice.rows.map((r) => r.itemId).filter(Boolean))];
    const oldItems = oldItemIds.length > 0 ? await tx.item.findMany({ where: { id: { in: oldItemIds } } }) : [];
    const oldItemMap = new Map(oldItems.map((i) => [i.id, i]));

    for (const r of oldInvoice.rows) {
      if (r.itemId) {
        const item = oldItemMap.get(r.itemId);
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;
          const costVal = baseQty * Number(item.purchasePrice || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal + costVal;

          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { increment: baseQty },
              stockValue: newVal,
            },
          });
        }
      }
    }

    // 2. Delete old StockLedger entries for this reference
    await tx.stockLedger.deleteMany({
      where: { referenceType: 'SALES_INVOICE', referenceId: id },
    });

    // 3. Resolve and apply new stock changes using batch helper
    const { resolvedRows, itemById } = await batchResolveItemsAndUnits(tx, businessId, newRowsData);

    const stockLedgerEntries = [];
    for (const r of resolvedRows) {
      if (r.itemId) {
        const item = r._item || itemById.get(r.itemId);
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;
          const costVal = baseQty * Number(item.purchasePrice || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal - costVal;

          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { decrement: baseQty },
              stockValue: newVal,
            },
          });

          stockLedgerEntries.push({
            businessId,
            itemId: r.itemId,
            type: 'OUT',
            quantity: baseQty,
            adjustedValue: costVal,
            description: `Sales Invoice ${oldInvoice.invoiceNo} (Edited)`,
            referenceType: 'SALES_INVOICE',
            referenceId: id,
          });
        }
      }
    }

    if (stockLedgerEntries.length > 0) {
      await tx.stockLedger.createMany({ data: stockLedgerEntries });
    }
    // 4. Update the Invoice rows: Delete old ones and create new ones
    await tx.salesInvoiceRow.deleteMany({ where: { invoiceId: id } });

    const grandTotal = Number(invoiceUpdateFields.grandTotal);
    const newPaid = Math.min(Math.max(Number(paid) || 0, 0), grandTotal);

    // Locate the auto-created payment linked to this invoice
    const oldAutoAllocation = await tx.paymentInAllocation.findFirst({
      where: {
        invoiceId: id,
        paymentIn: {
          description: { startsWith: `Auto-payment for Invoice ${oldInvoice.invoiceNo}` }
        }
      },
      include: { paymentIn: true }
    });

    if (oldAutoAllocation) {
      // Revert the old bank account balance if it was bank
      if (oldAutoAllocation.paymentIn.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: oldAutoAllocation.paymentIn.bankAccountId },
          data: {
            currentBalance: { decrement: Number(oldAutoAllocation.paymentIn.receivedAmount) }
          }
        });
        await tx.bankingTransaction.deleteMany({
          where: {
            bankAccountId: oldAutoAllocation.paymentIn.bankAccountId,
            description: `Payment for Invoice ${oldInvoice.invoiceNo}`
          }
        });
      }

      if (newPaid > 0) {
        // Update old auto-payment
        await tx.paymentIn.update({
          where: { id: oldAutoAllocation.paymentInId },
          data: {
            receivedAmount: newPaid,
            bankAccountId: bankAccountId || null,
            paymentMode: bankAccountId ? 'BANK' : 'CASH',
            date: invoiceUpdateFields.date || oldAutoAllocation.paymentIn.date,
          }
        });

        // Update allocation
        await tx.paymentInAllocation.update({
          where: { id: oldAutoAllocation.id },
          data: { amount: newPaid }
        });

        // Apply new bank account balance if bank
        if (bankAccountId) {
          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: {
              currentBalance: { increment: newPaid }
            }
          });
          await tx.bankingTransaction.create({
            data: {
              businessId,
              bankAccountId,
              date: invoiceUpdateFields.date || oldAutoAllocation.paymentIn.date,
              type: 'DEPOSIT',
              amount: newPaid,
              description: `Payment for Invoice ${oldInvoice.invoiceNo}`,
            }
          });
        }
      } else {
        // paid is now 0, delete auto-payment and allocation
        await tx.paymentInAllocation.delete({ where: { id: oldAutoAllocation.id } });
        await tx.paymentIn.delete({ where: { id: oldAutoAllocation.paymentInId } });
      }
    } else if (newPaid > 0) {
      // No old auto-payment existed, but newPaid is > 0. Create new auto-payment.
      const receiptNo = await generateDocNo(tx, businessId, 'receipt');
      const payment = await tx.paymentIn.create({
        data: {
          businessId,
          partyId: invoiceUpdateFields.partyId || oldInvoice.partyId,
          bankAccountId: bankAccountId || null,
          receiptNo,
          date: invoiceUpdateFields.date || oldInvoice.date,
          receivedAmount: newPaid,
          paymentMode: bankAccountId ? 'BANK' : 'CASH',
          description: `Auto-payment for Invoice ${oldInvoice.invoiceNo}`,
        }
      });
      await tx.paymentInAllocation.create({
        data: {
          paymentInId: payment.id,
          invoiceId: id,
          amount: newPaid
        }
      });

      if (bankAccountId) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            currentBalance: { increment: newPaid }
          }
        });
        await tx.bankingTransaction.create({
          data: {
            businessId,
            bankAccountId,
            date: invoiceUpdateFields.date || oldInvoice.date,
            type: 'DEPOSIT',
            amount: newPaid,
            description: `Payment for Invoice ${oldInvoice.invoiceNo}`,
          }
        });
      }
    }

    // Now compute correct balance and total paid from all allocations
    const allocations = await tx.paymentInAllocation.findMany({
      where: { invoiceId: id },
    });
    const totalAllocated = allocations.reduce((sum, alloc) => sum + Number(alloc.amount), 0);
    const newBalance = Math.max(0, grandTotal - totalAllocated);

    const updatedInvoice = await tx.salesInvoice.update({
      where: { id },
      data: {
        ...invoiceUpdateFields,
        paid: totalAllocated,
        balance: newBalance,
        rows: {
          create: resolvedRows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn || null,
            qty: r.qty,
            unit: r.unit || '',
            unitMultiplier: Number(r.unitMultiplier) || 1,
            price: r.price,
            discountValue: r.discountValue || 0,
            discountIsPercentage: r.discountIsPercentage || false,
            taxRate: r.taxRate || 0,
            taxAmount: r.taxAmount || 0,
            total: r.total,
            box: r.box ?? null,
          })),
        },
      },
      include: { rows: true },
    });

    await auditService.logDocumentAction({
      tx,
      businessId,
      documentType: 'SALES_INVOICE',
      documentId: id,
      documentNo: oldInvoice.invoiceNo,
      action: 'UPDATE',
      changes: {
        before: { grandTotal: oldInvoice.grandTotal, rows: oldInvoice.rows },
        after: { grandTotal: updatedInvoice.grandTotal, rows: updatedInvoice.rows },
      },
      userId,
    });

    return updatedInvoice;
  });
};

const updateEstimate = async (businessId, id, data, userId) => {
  const oldDoc = await prisma.estimate.findFirst({
    where: { id, businessId, isArchived: false },
    include: { rows: true },
  });
  if (!oldDoc) throw new ApiError(httpStatus.NOT_FOUND, 'Estimate not found');

  const { rows, ...updateFields } = data;

  return await prisma.$transaction(async (tx) => {
    await tx.estimateRow.deleteMany({ where: { estimateId: id } });

    const updated = await tx.estimate.update({
      where: { id },
      data: {
        ...updateFields,
        rows: {
          create: rows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn || null,
            qty: r.qty,
            unit: r.unit || '',
            unitMultiplier: Number(r.unitMultiplier) || 1,
            price: r.price,
            discountValue: r.discountValue || 0,
            discountIsPercentage: r.discountIsPercentage || false,
            taxRate: r.taxRate || 0,
            taxAmount: r.taxAmount || 0,
            total: r.total,
          })),
        },
      },
      include: { rows: true },
    });

    await auditService.logDocumentAction({
      tx,
      businessId,
      documentType: 'ESTIMATE',
      documentId: id,
      documentNo: oldDoc.estimateNo,
      action: 'UPDATE',
      changes: { before: oldDoc, after: updated },
      userId,
    });

    return updated;
  });
};

const updatePaymentIn = async (businessId, id, data, userId) => {
  const oldDoc = await prisma.paymentIn.findFirst({
    where: { id, businessId },
    include: { allocations: true },
  });
  if (!oldDoc) throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');

  const { receivedAmount, bankAccountId, date, description, paymentMode, referenceNo } = data;

  return await prisma.$transaction(async (tx) => {
    if (oldDoc.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: oldDoc.bankAccountId },
        data: { currentBalance: { decrement: Number(oldDoc.receivedAmount) } },
      });

      await tx.bankingTransaction.deleteMany({
        where: {
          businessId,
          bankAccountId: oldDoc.bankAccountId,
          description: `Payment for Invoice ${oldDoc.receiptNo}`,
        },
      });
    }

    if (bankAccountId) {
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: { increment: Number(receivedAmount) } },
      });

      await tx.bankingTransaction.create({
        data: {
          businessId,
          bankAccountId,
          date: new Date(date),
          type: 'DEPOSIT',
          amount: receivedAmount,
          description: `Payment for Invoice ${oldDoc.receiptNo} (Updated)`,
        },
      });
    }

    const updated = await tx.paymentIn.update({
      where: { id },
      data: {
        receivedAmount,
        bankAccountId: bankAccountId || null,
        date: new Date(date),
        description: description || null,
        paymentMode,
        referenceNo: referenceNo || null,
      },
    });

    await auditService.logDocumentAction({
      tx,
      businessId,
      documentType: 'PAYMENT_IN',
      documentId: id,
      documentNo: oldDoc.receiptNo,
      action: 'UPDATE',
      changes: { before: oldDoc, after: updated },
      userId,
    });

    return updated;
  });
};

const updateReturn = async (businessId, id, data, userId) => {
  const oldDoc = await prisma.salesReturn.findFirst({
    where: { id, businessId },
    include: { rows: true },
  });
  if (!oldDoc) throw new ApiError(httpStatus.NOT_FOUND, 'Sales Return not found');

  const { rows, ...updateFields } = data;

  return await prisma.$transaction(async (tx) => {
    await tx.salesReturnRow.deleteMany({ where: { salesReturnId: id } });

    const updated = await tx.salesReturn.update({
      where: { id },
      data: {
        ...updateFields,
        rows: {
          create: rows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            qty: r.qty,
            unit: r.unit || '',
            price: r.price,
            total: r.total,
          })),
        },
      },
      include: { rows: true },
    });

    await auditService.logDocumentAction({
      tx,
      businessId,
      documentType: 'SALES_RETURN',
      documentId: id,
      documentNo: oldDoc.returnNo,
      action: 'UPDATE',
      changes: { before: oldDoc, after: updated },
      userId,
    });

    return updated;
  });
};

const updateChallan = async (businessId, id, data, userId) => {
  const oldDoc = await prisma.deliveryChallan.findFirst({
    where: { id, businessId },
    include: { rows: true },
  });
  if (!oldDoc) throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');

  const { rows, ...updateFields } = data;

  return await prisma.$transaction(async (tx) => {
    for (const r of oldDoc.rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;
          const costVal = baseQty * Number(item.purchasePrice || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal + costVal;

          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { increment: baseQty },
              stockValue: newVal,
            },
          });
        }
      }
    }

    await tx.stockLedger.deleteMany({
      where: { referenceType: 'DELIVERY_CHALLAN', referenceId: id },
    });

    const resolvedRows = [];
    for (const r of rows) {
      let resolvedItemId = r.itemId;
      if (!resolvedItemId && r.itemName) {
        let item = await tx.item.findFirst({
          where: { name: r.itemName.trim(), businessId, isArchived: false },
        });
        if (!item) {
          item = await tx.item.create({
            data: {
              businessId,
              name: r.itemName.trim(),
              type: 'PRODUCT',
              salePrice: Number(r.price) || 0,
              purchasePrice: 0,
              stockQuantity: 0,
              taxRate: Number(r.taxRate) || 0,
              hsn: r.hsn || null,
            },
          });
        }
        resolvedItemId = item.id;
      }
      resolvedRows.push({ ...r, itemId: resolvedItemId });
    }

    for (const r of resolvedRows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;
          const costVal = baseQty * Number(item.purchasePrice || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal - costVal;

          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { decrement: baseQty },
              stockValue: newVal,
            },
          });

          await tx.stockLedger.create({
            data: {
              businessId,
              itemId: r.itemId,
              type: 'OUT',
              quantity: baseQty,
              adjustedValue: costVal,
              description: `Challan Dispatch ${oldDoc.challanNo} (Edited)`,
              referenceType: 'DELIVERY_CHALLAN',
              referenceId: id,
            },
          });
        }
      }
    }

    await tx.deliveryChallanRow.deleteMany({ where: { deliveryChallanId: id } });

    const updated = await tx.deliveryChallan.update({
      where: { id },
      data: {
        ...updateFields,
        rows: {
          create: resolvedRows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn || null,
            qty: r.qty,
            unit: r.unit || '',
            unitMultiplier: Number(r.unitMultiplier) || 1,
            price: r.price,
            total: r.total,
          })),
        },
      },
      include: { rows: true },
    });

    await auditService.logDocumentAction({
      tx,
      businessId,
      documentType: 'DELIVERY_CHALLAN',
      documentId: id,
      documentNo: oldDoc.challanNo,
      action: 'UPDATE',
      changes: { before: oldDoc, after: updated },
      userId,
    });

    return updated;
  });
};

const updateOrder = async (businessId, id, data, userId) => {
  const oldDoc = await prisma.salesOrder.findFirst({
    where: { id, businessId },
    include: { rows: true },
  });
  if (!oldDoc) throw new ApiError(httpStatus.NOT_FOUND, 'Sales Order not found');

  const { rows, ...updateFields } = data;

  return await prisma.$transaction(async (tx) => {
    for (const r of oldDoc.rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;

          await tx.item.update({
            where: { id: r.itemId },
            data: { allocatedStock: { decrement: baseQty } },
          });
        }
      }
    }

    const resolvedRows = [];
    for (const r of rows) {
      let resolvedItemId = r.itemId;
      if (!resolvedItemId && r.itemName) {
        let item = await tx.item.findFirst({
          where: { name: r.itemName.trim(), businessId, isArchived: false },
        });
        if (!item) {
          item = await tx.item.create({
            data: {
              businessId,
              name: r.itemName.trim(),
              type: 'PRODUCT',
              salePrice: Number(r.price) || 0,
              purchasePrice: 0,
              stockQuantity: 0,
              taxRate: Number(r.taxRate) || 0,
              hsn: r.hsn || null,
            },
          });
        }
        resolvedItemId = item.id;
      }
      resolvedRows.push({ ...r, itemId: resolvedItemId });
    }

    for (const r of resolvedRows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;

          await tx.item.update({
            where: { id: r.itemId },
            data: { allocatedStock: { increment: baseQty } },
          });
        }
      }
    }

    await tx.salesOrderRow.deleteMany({ where: { salesOrderId: id } });

    const updated = await tx.salesOrder.update({
      where: { id },
      data: {
        ...updateFields,
        rows: {
          create: resolvedRows.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            hsn: r.hsn || null,
            qty: r.qty,
            unit: r.unit || '',
            unitMultiplier: Number(r.unitMultiplier) || 1,
            price: r.price,
            total: r.total,
          })),
        },
      },
      include: { rows: true },
    });

    await auditService.logDocumentAction({
      tx,
      businessId,
      documentType: 'SALES_ORDER',
      documentId: id,
      documentNo: oldDoc.orderNo,
      action: 'UPDATE',
      changes: { before: oldDoc, after: updated },
      userId,
    });

    return updated;
  });
};

// =========================================================================
// FILE ATTACHMENTS (Sales Invoice)
// =========================================================================

const uploadInvoiceFile = async (businessId, invoiceId, file) => {
  // Verify invoice belongs to business
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: invoiceId, businessId },
  });
  if (!invoice) throw new ApiError(httpStatus.NOT_FOUND, 'Invoice not found');

  const saved = await prisma.file.create({
    data: {
      businessId,
      originalName: file.originalname,
      storedPath: file.path.replace(/\\/g, '/'),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      referenceType: 'SALES_INVOICE',
      referenceId: invoiceId,
    },
  });
  return saved;
};

const listInvoiceFiles = async (businessId, invoiceId) => {
  return await prisma.file.findMany({
    where: {
      businessId,
      referenceType: 'SALES_INVOICE',
      referenceId: invoiceId,
    },
    orderBy: { createdAt: 'desc' },
  });
};

const deleteInvoiceFile = async (businessId, invoiceId, fileId) => {
  const file = await prisma.file.findFirst({
    where: { id: fileId, businessId, referenceType: 'SALES_INVOICE', referenceId: invoiceId },
  });
  if (!file) throw new ApiError(httpStatus.NOT_FOUND, 'File not found');

  // Delete physical file
  try {
    const fs = await import('fs');
    if (fs.existsSync(file.storedPath)) {
      fs.unlinkSync(file.storedPath);
    }
  } catch (e) {
    console.error('Failed to delete file from disk:', e);
  }

  await prisma.file.delete({ where: { id: fileId } });
  return { success: true };
};

const updateDocumentTitle = async (businessId, documentType, documentId, customTitle) => {
  const typeStr = (documentType || '').toLowerCase();
  const idNum = parseInt(documentId, 10);
  const docIdStr = String(documentId);

  let model;
  let label;
  let matchConditions = [];

  if (!isNaN(idNum) && idNum > 0) {
    matchConditions.push({ id: idNum });
  }

  if (typeStr.includes('purchase')) {
    model = prisma.purchaseInvoice;
    label = 'Purchase invoice';
    matchConditions.push({ billNo: docIdStr });
  } else if (typeStr.includes('estimate') || typeStr.includes('quote')) {
    model = prisma.estimate;
    label = 'Estimate';
    matchConditions.push({ estimateNo: docIdStr });
  } else if (typeStr.includes('challan')) {
    model = prisma.deliveryChallan;
    label = 'Delivery challan';
    matchConditions.push({ challanNo: docIdStr });
  } else if (typeStr.includes('order')) {
    model = prisma.salesOrder;
    label = 'Sales order';
    matchConditions.push({ orderNo: docIdStr });
  } else {
    model = prisma.salesInvoice;
    label = 'Sales invoice';
    matchConditions.push({ invoiceNo: docIdStr });
  }

  const result = await model.updateMany({
    where: {
      businessId,
      OR: matchConditions,
    },
    data: { customTitle },
  });

  if (result.count === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, `${label} not found`);
  }

  return { customTitle };
};

const salesService = {
  createInvoice,
  listInvoices,
  getInvoice,
  deleteInvoice,
  updateInvoice,
  createEstimate,
  listEstimates,
  deleteEstimate,
  updateEstimate,
  convertEstimateToInvoice,
  createPaymentIn,
  listPaymentsIn,
  updatePaymentIn,
  deletePaymentIn,
  createReturn,
  listReturns,
  updateReturn,
  deleteReturn,
  createChallan,
  listChallans,
  updateChallanStatus,
  updateChallan,
  convertChallanToInvoice,
  createOrder,
  listOrders,
  updateOrderStatus,
  updateOrder,
  convertOrderToInvoice,
  listDeletedInvoices,
  uploadInvoiceFile,
  listInvoiceFiles,
  deleteInvoiceFile,
  updateDocumentTitle,
};

export { salesService };
export default salesService;
