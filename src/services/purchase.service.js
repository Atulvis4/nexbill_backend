import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';
import auditService from './audit.service.js';

const generateDocNo = async (tx, businessId, type) => {
  const business = await tx.business.findUnique({ where: { id: businessId } });
  if (!business) throw new Error('Business not found');

  let prefix = '';
  let nextVal = 1;

  if (type === 'purchase') {
    prefix = business.numberingPurchasePrefix || `PUR-${businessId}-`;
    nextVal = business.numberingPurchaseNext;
  } else if (type === 'paymentOut') {
    prefix = business.numberingPaymentOutPrefix || `POUT-${businessId}-`;
    nextVal = business.numberingPaymentOutNext;
  } else if (type === 'debitNote') {
    prefix = business.numberingDebitNotePrefix || `DN-${businessId}-`;
    nextVal = business.numberingDebitNoteNext;
  }

  // Collision-avoidance: skip numbers that already exist in the DB
  let generatedNo;
  let exists = true;
  while (exists) {
    generatedNo = `${prefix}${nextVal}`;
    exists = false;

    if (type === 'purchase') {
      const rec = await tx.purchaseInvoice.findUnique({ where: { billNo: generatedNo } });
      if (rec) exists = true;
    } else if (type === 'paymentOut') {
      const rec = await tx.paymentOut.findUnique({ where: { paymentNo: generatedNo } });
      if (rec) exists = true;
    } else if (type === 'debitNote') {
      const rec = await tx.purchaseReturn.findUnique({ where: { returnNo: generatedNo } });
      if (rec) exists = true;
    }

    if (exists) nextVal++;
  }

  // Update the counter to one past the used value
  let updateField = {};
  if (type === 'purchase') updateField = { numberingPurchaseNext: nextVal + 1 };
  else if (type === 'paymentOut') updateField = { numberingPaymentOutNext: nextVal + 1 };
  else if (type === 'debitNote') updateField = { numberingDebitNoteNext: nextVal + 1 };

  await tx.business.update({ where: { id: businessId }, data: updateField });

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
        balanceType: 'PAYABLE',
      },
    });
  }
  return party.id;
};

const createPurchase = async (businessId, data) => {
  // ─── Payment safety: clamp paid to [0, grandTotal] server-side ───
  const { rows, bankAccountId, paid: rawPaid, balance: rawBalance, ...purchaseData } = data;

  return await prisma.$transaction(async (tx) => {
    // Resolve or auto-create party
    const resolvedPartyId = await resolveOrCreateParty(
      tx,
      businessId,
      purchaseData.partyId,
      purchaseData.partyName,
      purchaseData.phone,
      purchaseData.stateOfSupply
    );
    purchaseData.partyId = resolvedPartyId;

    // Validate bill number if provided
    if (purchaseData.billNo) {
      const existing = await tx.purchaseInvoice.findUnique({
        where: { billNo: purchaseData.billNo },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, `Bill number '${purchaseData.billNo}' already exists`);
      }
    }
    const billNo = purchaseData.billNo || (await generateDocNo(tx, businessId, 'purchase'));

    // Auto-resolve or create items if they don't exist in the item list
    const resolvedRows = [];
    for (const r of rows) {
      let resolvedItemId = r.itemId;
      if (r.itemName) {
        // Look up by name case-insensitively, ignoring leading/trailing spaces
        let item = await tx.item.findFirst({
          where: {
            businessId,
            name: { equals: r.itemName.trim() },
            isArchived: false,
          },
        });

        if (!item) {
          // Find unit if specified
          let unitId = null;
          if (r.unit) {
            const matchedUnit = await tx.unit.findFirst({
              where: {
                businessId,
                name: { equals: r.unit.trim() },
              },
            });
            if (matchedUnit) {
              unitId = matchedUnit.id;
            }
          }

          // Create new PRODUCT item with quantity 0, salePrice 0, and purchasePrice from row
          item = await tx.item.create({
            data: {
              businessId,
              name: r.itemName.trim(),
              type: 'PRODUCT',
              salePrice: 0,
              purchasePrice: Number(r.price) || 0,
              stockQuantity: 0,
              taxRate: Number(r.taxRate) || 0,
              hsn: r.hsn || null,
              unitId,
            },
          });
        }
        resolvedItemId = item.id;
      }

      resolvedRows.push({
        ...r,
        itemId: resolvedItemId,
      });
    }

    // Clamp paid to [0, grandTotal] — backend is the source of truth
    const safePaid = Math.min(Math.max(Number(rawPaid) || 0, 0), Number(purchaseData.grandTotal));
    const safeBalance = Number(purchaseData.grandTotal) - safePaid;

    const purchase = await tx.purchaseInvoice.create({
      data: {
        ...purchaseData,
        billNo,
        businessId,
        subtotal: purchaseData.subtotal,
        discountValue: purchaseData.discountValue || 0,
        discountIsPercentage: purchaseData.discountIsPercentage || false,
        cgst: purchaseData.cgst,
        sgst: purchaseData.sgst,
        igst: purchaseData.igst,
        totalTax: purchaseData.totalTax,
        grandTotal: purchaseData.grandTotal,
        paid: safePaid,
        balance: safeBalance,
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

    // Update stock levels & log stock ledgers using resolvedRows
    for (const r of resolvedRows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;
          const adjustmentVal = baseQty * Number(r.price || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal + adjustmentVal;

          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { increment: baseQty },
              stockValue: newVal,
            },
          });

          await tx.stockLedger.create({
            data: {
              businessId,
              itemId: r.itemId,
              type: 'IN',
              quantity: baseQty,
              adjustedValue: adjustmentVal,
              description: `Purchase Invoice ${billNo}`,
              referenceType: 'PURCHASE_INVOICE',
              referenceId: purchase.id,
            },
          });
        }
      }
    }

    // Handle payment out
    if (safePaid > 0) {
      const paymentNo = `PAY-${Date.now()}`;

      const paymentOut = await tx.paymentOut.create({
        data: {
          businessId,
          partyId: purchaseData.partyId,
          bankAccountId: bankAccountId || null,
          paymentNo,
          date: purchaseData.date,
          amount: safePaid,
          paymentMode: bankAccountId ? 'BANK' : 'CASH',
          description: `Auto-payment for Bill ${billNo}`,
        },
      });

      await tx.paymentOutAllocation.create({
        data: {
          paymentOutId: paymentOut.id,
          purchaseInvoiceId: purchase.id,
          amount: safePaid,
        },
      });

      if (bankAccountId) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            currentBalance: { decrement: safePaid },
          },
        });

        await tx.bankingTransaction.create({
          data: {
            businessId,
            bankAccountId,
            date: purchaseData.date,
            type: 'WITHDRAWAL',
            amount: safePaid,
            description: `Payment for Bill ${billNo}`,
          },
        });
      }
    }

    return purchase;
  });
};

const listPurchases = async (businessId) => {
  return await prisma.purchaseInvoice.findMany({
    where: { businessId, isArchived: false },
    include: { rows: true },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
  });
};

const getPurchase = async (businessId, id) => {
  const purchase = await prisma.purchaseInvoice.findFirst({
    where: { id, businessId, isArchived: false },
    include: { rows: true, allocations: { include: { paymentOut: true } } },
  });
  if (!purchase) throw new ApiError(httpStatus.NOT_FOUND, 'Purchase invoice not found');
  return purchase;
};

const deletePurchase = async (businessId, id) => {
  const purchase = await prisma.purchaseInvoice.findFirst({
    where: { id, businessId, isArchived: false },
  });

  if (!purchase) throw new ApiError(httpStatus.NOT_FOUND, 'Purchase invoice not found');

  await prisma.purchaseInvoice.update({
    where: { id },
    data: { isArchived: true },
  });

  return { success: true };
};

const deletePaymentOut = async (businessId, id) => {
  const payment = await prisma.paymentOut.findFirst({
    where: { id, businessId },
  });

  if (!payment) throw new ApiError(httpStatus.NOT_FOUND, 'Payment out not found');

  return await prisma.$transaction(async (tx) => {
    await tx.paymentOutAllocation.deleteMany({ where: { paymentOutId: id } });
    await tx.paymentOut.delete({ where: { id } });
    return { success: true };
  });
};

const listPaymentsOut = async (businessId) => {
  return await prisma.paymentOut.findMany({
    where: { businessId },
    include: { allocations: { include: { purchaseInvoice: true } }, party: true, salesReturn: true },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
  });
};

const createPaymentOut = async (businessId, data) => {
  return await prisma.$transaction(async (tx) => {
    if (data.paymentNo) {
      const existing = await tx.paymentOut.findUnique({
        where: { paymentNo: data.paymentNo },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, `Payment number '${data.paymentNo}' already exists`);
      }
    }
    const paymentNo = data.paymentNo || (await generateDocNo(tx, businessId, 'paymentOut'));

    const payment = await tx.paymentOut.create({
      data: {
        businessId,
        partyId: data.partyId,
        bankAccountId: data.bankAccountId || null,
        paymentNo,
        date: new Date(data.date),
        amount: data.amount,
        paymentMode: data.paymentMode,
        referenceNo: data.referenceNo,
        description: data.description,
        salesReturnId: data.salesReturnId || null,
      },
      include: { party: true, salesReturn: true },
    });

    // Update bank balance if bankAccountId is provided
    if (data.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { currentBalance: { decrement: data.amount } },
      });

      await tx.bankingTransaction.create({
        data: {
          businessId,
          bankAccountId: data.bankAccountId,
          date: new Date(data.date),
          type: 'WITHDRAWAL',
          amount: data.amount,
          description: `Payment Out receipt ${paymentNo}`,
        },
      });
    }

    // Allocate payment using FIFO waterfall to unpaid purchaseInvoices (only if not a sales return refund)
    if (data.partyId && !data.salesReturnId) {
      const openInvoices = await tx.purchaseInvoice.findMany({
        where: {
          businessId,
          partyId: data.partyId,
          balance: { gt: 0 },
          isArchived: false,
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      });

      let remaining = Number(data.amount);
      for (const inv of openInvoices) {
        if (remaining <= 0) break;

        const invBalance = Number(inv.balance);
        const allocationAmount = Math.min(remaining, invBalance);

        // Record allocation
        await tx.paymentOutAllocation.create({
          data: {
            paymentOutId: payment.id,
            purchaseInvoiceId: inv.id,
            amount: allocationAmount,
          },
        });

        // Update purchase invoice
        await tx.purchaseInvoice.update({
          where: { id: inv.id },
          data: {
            paid: { increment: allocationAmount },
            balance: { decrement: allocationAmount },
          },
        });

        remaining -= allocationAmount;
      }
    }

    // Mark the linked sales return refund as PAID
    if (data.salesReturnId) {
      await tx.salesReturn.update({
        where: { id: data.salesReturnId },
        data: { refundStatus: 'PAID' },
      });
    }

    return payment;
  });
};

const updatePurchase = async (businessId, id, data, userId) => {
  const oldDoc = await prisma.purchaseInvoice.findFirst({
    where: { id, businessId, isArchived: false },
    include: { rows: true },
  });
  if (!oldDoc) throw new ApiError(httpStatus.NOT_FOUND, 'Purchase Invoice not found');

  const { rows, paid, bankAccountId, ...updateFields } = data;

  return await prisma.$transaction(async (tx) => {
    // 1. Revert old stock increases
    for (const r of oldDoc.rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          const multiplier = Number(r.unitMultiplier) || 1;
          const baseQty = Number(r.qty) * multiplier;
          const costVal = baseQty * Number(r.price || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal - costVal;

          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { decrement: baseQty },
              stockValue: newVal,
            },
          });
        }
      }
    }

    // 2. Delete old StockLedgers
    await tx.stockLedger.deleteMany({
      where: { referenceType: 'PURCHASE_INVOICE', referenceId: id },
    });

    // 3. Resolve and apply new stock increases
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
              salePrice: 0,
              purchasePrice: Number(r.price) || 0,
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
          const costVal = baseQty * Number(r.price || 0);
          const currentVal = Number(item.stockValue || 0);
          const newVal = currentVal + costVal;

          await tx.item.update({
            where: { id: r.itemId },
            data: {
              stockQuantity: { increment: baseQty },
              stockValue: newVal,
            },
          });

          await tx.stockLedger.create({
            data: {
              businessId,
              itemId: r.itemId,
              type: 'IN',
              quantity: baseQty,
              adjustedValue: costVal,
              description: `Purchase Invoice ${oldDoc.billNo} (Edited)`,
              referenceType: 'PURCHASE_INVOICE',
              referenceId: id,
            },
          });
        }
      }
    }
    // 4. Update the Invoice rows: Delete old ones and create new ones
    await tx.purchaseInvoiceRow.deleteMany({ where: { purchaseInvoiceId: id } });

    const grandTotal = Number(updateFields.grandTotal);
    const newPaid = Math.min(Math.max(Number(paid) || 0, 0), grandTotal);

    // Locate the auto-created payment linked to this purchase invoice
    const oldAutoAllocation = await tx.paymentOutAllocation.findFirst({
      where: {
        purchaseInvoiceId: id,
        paymentOut: {
          description: { startsWith: `Auto-payment for Bill ${oldDoc.billNo}` }
        }
      },
      include: { paymentOut: true }
    });

    if (oldAutoAllocation) {
      // Revert the old bank account balance if bank
      if (oldAutoAllocation.paymentOut.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: oldAutoAllocation.paymentOut.bankAccountId },
          data: {
            currentBalance: { increment: Number(oldAutoAllocation.paymentOut.amount) }
          }
        });
        await tx.bankingTransaction.deleteMany({
          where: {
            bankAccountId: oldAutoAllocation.paymentOut.bankAccountId,
            description: `Payment for Bill ${oldDoc.billNo}`
          }
        });
      }

      if (newPaid > 0) {
        // Update old auto-payment
        await tx.paymentOut.update({
          where: { id: oldAutoAllocation.paymentOutId },
          data: {
            amount: newPaid,
            bankAccountId: bankAccountId || null,
            paymentMode: bankAccountId ? 'BANK' : 'CASH',
            date: updateFields.date || oldAutoAllocation.paymentOut.date,
          }
        });

        // Update allocation
        await tx.paymentOutAllocation.update({
          where: { id: oldAutoAllocation.id },
          data: { amount: newPaid }
        });

        // Apply new bank account balance if bank
        if (bankAccountId) {
          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: {
              currentBalance: { decrement: newPaid }
            }
          });
          await tx.bankingTransaction.create({
            data: {
              businessId,
              bankAccountId,
              date: updateFields.date || oldAutoAllocation.paymentOut.date,
              type: 'WITHDRAWAL',
              amount: newPaid,
              description: `Payment for Bill ${oldDoc.billNo}`,
            }
          });
        }
      } else {
        // paid is now 0, delete auto-payment and allocation
        await tx.paymentOutAllocation.delete({ where: { id: oldAutoAllocation.id } });
        await tx.paymentOut.delete({ where: { id: oldAutoAllocation.paymentOutId } });
      }
    } else if (newPaid > 0) {
      // No old auto-payment existed, but newPaid is > 0. Create new auto-payment.
      const paymentNo = `PAY-${Date.now()}`;
      const payment = await tx.paymentOut.create({
        data: {
          businessId,
          partyId: updateFields.partyId || oldDoc.partyId,
          bankAccountId: bankAccountId || null,
          paymentNo,
          date: updateFields.date || oldDoc.date,
          amount: newPaid,
          paymentMode: bankAccountId ? 'BANK' : 'CASH',
          description: `Auto-payment for Bill ${oldDoc.billNo}`,
        }
      });
      await tx.paymentOutAllocation.create({
        data: {
          paymentOutId: payment.id,
          purchaseInvoiceId: id,
          amount: newPaid
        }
      });

      if (bankAccountId) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            currentBalance: { decrement: newPaid }
          }
        });
        await tx.bankingTransaction.create({
          data: {
            businessId,
            bankAccountId,
            date: updateFields.date || oldDoc.date,
            type: 'WITHDRAWAL',
            amount: newPaid,
            description: `Payment for Bill ${oldDoc.billNo}`,
          }
        });
      }
    }

    // Now compute correct balance and total paid from all allocations
    const allocations = await tx.paymentOutAllocation.findMany({
      where: { purchaseInvoiceId: id },
    });
    const totalAllocated = allocations.reduce((sum, alloc) => sum + Number(alloc.amount), 0);
    const newBalance = Math.max(0, grandTotal - totalAllocated);

    const updated = await tx.purchaseInvoice.update({
      where: { id },
      data: {
        ...updateFields,
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
      documentType: 'PURCHASE_INVOICE',
      documentId: id,
      documentNo: oldDoc.billNo,
      action: 'UPDATE',
      changes: { before: oldDoc, after: updated },
      userId,
    });

    return updated;
  });
};

const updatePaymentOut = async (businessId, id, data, userId) => {
  const oldDoc = await prisma.paymentOut.findFirst({
    where: { id, businessId },
    include: { allocations: true },
  });
  if (!oldDoc) throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');

  const { amount, bankAccountId, date, description, paymentMode, referenceNo } = data;

  return await prisma.$transaction(async (tx) => {
    // Revert old bank balance
    if (oldDoc.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: oldDoc.bankAccountId },
        data: { currentBalance: { increment: Number(oldDoc.amount) } },
      });

      await tx.bankingTransaction.deleteMany({
        where: {
          businessId,
          bankAccountId: oldDoc.bankAccountId,
          description: `Payment Out ${oldDoc.receiptNo}`,
        },
      });
    }

    // Apply new bank balance
    if (bankAccountId) {
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: { decrement: Number(amount) } },
      });

      await tx.bankingTransaction.create({
        data: {
          businessId,
          bankAccountId,
          date: new Date(date),
          type: 'WITHDRAWAL',
          amount,
          description: `Payment Out ${oldDoc.receiptNo} (Updated)`,
        },
      });
    }

    const updated = await tx.paymentOut.update({
      where: { id },
      data: {
        amount,
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
      documentType: 'PAYMENT_OUT',
      documentId: id,
      documentNo: oldDoc.paymentNo,
      action: 'UPDATE',
      changes: { before: oldDoc, after: updated },
      userId,
    });

    return updated;
  });
};

// =========================================================================
// PURCHASE RETURNS / DEBIT NOTES
// =========================================================================

const createPurchaseReturn = async (businessId, data, userId) => {
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
      const existing = await tx.purchaseReturn.findUnique({
        where: { returnNo: returnData.returnNo },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, `Return number '${returnData.returnNo}' already exists`);
      }
    }
    const returnNo = returnData.returnNo || (await generateDocNo(tx, businessId, 'debitNote'));

    const preturn = await tx.purchaseReturn.create({
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

    // Deduct stock for returned items
    for (const r of rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          await tx.item.update({
            where: { id: r.itemId },
            data: { stockQuantity: { decrement: r.qty } },
          });

          await tx.stockLedger.create({
            data: {
              businessId,
              itemId: r.itemId,
              type: 'OUT',
              quantity: r.qty,
              description: `Purchase Return ${returnNo}`,
              referenceType: 'PURCHASE_RETURN',
              referenceId: preturn.id,
            },
          });
        }
      }
    }

    // Adjust purchase invoice balance
    if (returnData.returnType === 'DEBIT_NOTE' && returnData.originalBillId) {
      const bill = await tx.purchaseInvoice.findUnique({
        where: { id: returnData.originalBillId }
      });
      if (bill) {
        const applyAmount = Math.min(Number(bill.balance), Number(preturn.grandTotal));
        if (applyAmount > 0) {
          await tx.purchaseInvoice.update({
            where: { id: bill.id },
            data: {
              paid: { increment: applyAmount },
              balance: { decrement: applyAmount },
            }
          });
        }
      }
    }

    // Cash refund Payment In
    if (isCashRefund) {
      const receiptNo = await generateDocNo(tx, businessId, 'receipt');
      await tx.paymentIn.create({
        data: {
          businessId,
          partyId: preturn.partyId,
          receiptNo,
          date: preturn.date,
          receivedAmount: preturn.grandTotal,
          paymentMode: 'CASH',
          description: `Cash refund for Purchase Return ${returnNo}`,
          purchaseReturnId: preturn.id,
        }
      });
    }

    await auditService.logDocumentAction({
      tx,
      businessId,
      documentType: 'PURCHASE_RETURN',
      documentId: preturn.id,
      documentNo: returnNo,
      action: 'CREATE',
      changes: { after: preturn },
      userId,
    });

    return preturn;
  });
};

const listPurchaseReturns = async (businessId, search, fromDate, toDate, partyId) => {
  const where = {
    businessId,
    ...(partyId ? { partyId: Number(partyId) } : {}),
  };

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(fromDate);
    if (toDate) where.date.lte = new Date(toDate);
  }

  if (search) {
    where.OR = [
      { returnNo: { contains: search } },
      { party: { partyName: { contains: search } } },
    ];
  }

  return await prisma.purchaseReturn.findMany({
    where,
    include: { party: true, originalBill: true, rows: true },
    orderBy: { date: 'desc' },
  });
};

const getPurchaseReturn = async (businessId, id) => {
  const ret = await prisma.purchaseReturn.findFirst({
    where: { id, businessId },
    include: { party: true, originalBill: true, rows: true },
  });
  if (!ret) throw new ApiError(httpStatus.NOT_FOUND, 'Purchase return not found');
  return ret;
};

const updatePurchaseReturn = async (businessId, id, data, userId) => {
  const { rows, isCashRefund, ...returnData } = data;

  return await prisma.$transaction(async (tx) => {
    const oldReturn = await tx.purchaseReturn.findFirst({
      where: { id, businessId },
      include: { rows: true },
    });
    if (!oldReturn) throw new ApiError(httpStatus.NOT_FOUND, 'Purchase return not found');

    // 1. Revert stock changes from old rows (add back returned items to inventory)
    for (const r of oldReturn.rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          await tx.item.update({
            where: { id: r.itemId },
            data: { stockQuantity: { increment: r.qty } },
          });
        }
      }
    }
    // Delete old stock ledgers
    await tx.stockLedger.deleteMany({
      where: {
        businessId,
        referenceType: 'PURCHASE_RETURN',
        referenceId: id,
      },
    });

    // 2. Revert bill balance changes
    if (oldReturn.originalBillId) {
      await tx.purchaseInvoice.update({
        where: { id: oldReturn.originalBillId },
        data: {
          paid: { decrement: oldReturn.grandTotal },
          balance: { increment: oldReturn.grandTotal },
        },
      });
    }

    // 3. Resolve or auto-create party
    const resolvedPartyId = await resolveOrCreateParty(
      tx,
      businessId,
      returnData.partyId,
      returnData.partyName,
      returnData.phone,
      null
    );
    returnData.partyId = resolvedPartyId;

    // 4. Update the return record and create new rows
    await tx.purchaseReturnRow.deleteMany({ where: { purchaseReturnId: id } });

    const updated = await tx.purchaseReturn.update({
      where: { id },
      data: {
        ...returnData,
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

    // 5. Apply new stock changes
    for (const r of rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          await tx.item.update({
            where: { id: r.itemId },
            data: { stockQuantity: { decrement: r.qty } },
          });

          await tx.stockLedger.create({
            data: {
              businessId,
              itemId: r.itemId,
              type: 'OUT',
              quantity: r.qty,
              description: `Purchase Return ${updated.returnNo} (Updated)`,
              referenceType: 'PURCHASE_RETURN',
              referenceId: updated.id,
            },
          });
        }
      }
    }

    // 6. Apply new bill balance changes
    if (returnData.originalBillId) {
      const bill = await tx.purchaseInvoice.findUnique({
        where: { id: returnData.originalBillId }
      });
      if (bill) {
        const applyAmount = Math.min(Number(bill.balance), Number(updated.grandTotal));
        if (applyAmount > 0) {
          await tx.purchaseInvoice.update({
            where: { id: bill.id },
            data: {
              paid: { increment: applyAmount },
              balance: { decrement: applyAmount },
            }
          });
        }
      }
    }

    await auditService.logDocumentAction({
      tx,
      businessId,
      documentType: 'PURCHASE_RETURN',
      documentId: id,
      documentNo: updated.returnNo,
      action: 'UPDATE',
      changes: { before: oldReturn, after: updated },
      userId,
    });

    return updated;
  });
};

const deletePurchaseReturn = async (businessId, id, userId) => {
  return await prisma.$transaction(async (tx) => {
    const oldReturn = await tx.purchaseReturn.findFirst({
      where: { id, businessId },
      include: { rows: true },
    });
    if (!oldReturn) throw new ApiError(httpStatus.NOT_FOUND, 'Purchase return not found');

    // 1. Revert stock changes (add back items to inventory)
    for (const r of oldReturn.rows) {
      if (r.itemId) {
        const item = await tx.item.findUnique({ where: { id: r.itemId } });
        if (item && item.type === 'PRODUCT') {
          await tx.item.update({
            where: { id: r.itemId },
            data: { stockQuantity: { increment: r.qty } },
          });
        }
      }
    }
    await tx.stockLedger.deleteMany({
      where: {
        businessId,
        referenceType: 'PURCHASE_RETURN',
        referenceId: id,
      },
    });

    // 2. Revert bill balance changes
    if (oldReturn.originalBillId) {
      await tx.purchaseInvoice.update({
        where: { id: oldReturn.originalBillId },
        data: {
          paid: { decrement: oldReturn.grandTotal },
          balance: { increment: oldReturn.grandTotal },
        },
      });
    }

    // 3. Delete linked cash refund payments
    await tx.paymentIn.deleteMany({
      where: {
        businessId,
        purchaseReturnId: id,
      }
    });

    // 4. Delete return record
    await tx.purchaseReturn.delete({ where: { id } });

    await auditService.logDocumentAction({
      tx,
      businessId,
      documentType: 'PURCHASE_RETURN',
      documentId: id,
      documentNo: oldReturn.returnNo,
      action: 'DELETE',
      changes: { before: oldReturn },
      userId,
    });

    return { success: true };
  });
};

// =========================================================================
// FILE ATTACHMENTS (Purchase Invoice)
// =========================================================================

const uploadPurchaseFile = async (businessId, purchaseId, file) => {
  const purchase = await prisma.purchaseInvoice.findFirst({
    where: { id: purchaseId, businessId },
  });
  if (!purchase) throw new ApiError(httpStatus.NOT_FOUND, 'Purchase invoice not found');

  const saved = await prisma.file.create({
    data: {
      businessId,
      originalName: file.originalname,
      storedPath: file.path.replace(/\\/g, '/'),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      referenceType: 'PURCHASE_INVOICE',
      referenceId: purchaseId,
    },
  });
  return saved;
};

const listPurchaseFiles = async (businessId, purchaseId) => {
  return await prisma.file.findMany({
    where: {
      businessId,
      referenceType: 'PURCHASE_INVOICE',
      referenceId: purchaseId,
    },
    orderBy: { createdAt: 'desc' },
  });
};

const deletePurchaseFile = async (businessId, purchaseId, fileId) => {
  const file = await prisma.file.findFirst({
    where: { id: fileId, businessId, referenceType: 'PURCHASE_INVOICE', referenceId: purchaseId },
  });
  if (!file) throw new ApiError(httpStatus.NOT_FOUND, 'File not found');

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

const purchaseService = {
  createPurchase,
  listPurchases,
  getPurchase,
  deletePurchase,
  updatePurchase,
  listPaymentsOut,
  createPaymentOut,
  updatePaymentOut,
  deletePaymentOut,
  createPurchaseReturn,
  listPurchaseReturns,
  getPurchaseReturn,
  updatePurchaseReturn,
  deletePurchaseReturn,
  uploadPurchaseFile,
  listPurchaseFiles,
  deletePurchaseFile,
};

export { purchaseService };
export default purchaseService;


