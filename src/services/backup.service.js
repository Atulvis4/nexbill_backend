import prisma from '../config/prisma.js';

const exportBackup = async (businessId) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  const parties = await prisma.party.findMany({ where: { businessId } });
  const items = await prisma.item.findMany({ where: { businessId } });
  const categories = await prisma.category.findMany({ where: { businessId } });
  const units = await prisma.unit.findMany({ where: { businessId } });
  const salesInvoices = await prisma.salesInvoice.findMany({ where: { businessId }, include: { rows: true } });
  const purchaseInvoices = await prisma.purchaseInvoice.findMany({ where: { businessId }, include: { rows: true } });
  const estimates = await prisma.estimate.findMany({ where: { businessId }, include: { rows: true } });
  const paymentsIn = await prisma.paymentIn.findMany({ where: { businessId }, include: { allocations: true } });
  const paymentsOut = await prisma.paymentOut.findMany({ where: { businessId }, include: { allocations: true } });
  const salesReturns = await prisma.salesReturn.findMany({ where: { businessId }, include: { rows: true } });
  const deliveryChallans = await prisma.deliveryChallan.findMany({ where: { businessId }, include: { rows: true } });
  const salesOrders = await prisma.salesOrder.findMany({ where: { businessId }, include: { rows: true } });
  const bankAccounts = await prisma.bankAccount.findMany({ where: { businessId } });
  const bankingTransactions = await prisma.bankingTransaction.findMany({ where: { businessId } });
  const expenses = await prisma.expense.findMany({ where: { businessId } });
  const discounts = await prisma.discount.findMany({ where: { businessId } });

  return {
    origin: 'Ryappar-Server',
    schema_version: '1.0',
    timestamp: new Date().toISOString(),
    businessId,
    data: {
      business,
      parties,
      items,
      categories,
      units,
      salesInvoices,
      purchaseInvoices,
      estimates,
      paymentsIn,
      paymentsOut,
      salesReturns,
      deliveryChallans,
      salesOrders,
      bankAccounts,
      bankingTransactions,
      expenses,
      discounts,
    },
  };
};

const restoreBackup = async (businessId, backup) => {
  const { data } = backup;
  if (!data) throw new Error('Invalid backup schema');

  return await prisma.$transaction(async (tx) => {
    // Temporarily disable foreign key checks for clean restore
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

    try {
      // Delete existing records for this business
      await tx.salesInvoiceRow.deleteMany({ where: { invoice: { businessId } } });
      await tx.purchaseInvoiceRow.deleteMany({ where: { purchaseInvoice: { businessId } } });
      await tx.paymentInAllocation.deleteMany({ where: { paymentIn: { businessId } } });
      await tx.paymentOutAllocation.deleteMany({ where: { paymentOut: { businessId } } });
      await tx.salesReturnRow.deleteMany({ where: { salesReturn: { businessId } } });
      await tx.deliveryChallanRow.deleteMany({ where: { deliveryChallan: { businessId } } });
      await tx.salesOrderRow.deleteMany({ where: { salesOrder: { businessId } } });
      await tx.estimateRow.deleteMany({ where: { estimate: { businessId } } });

      await tx.salesInvoice.deleteMany({ where: { businessId } });
      await tx.purchaseInvoice.deleteMany({ where: { businessId } });
      await tx.estimate.deleteMany({ where: { businessId } });
      await tx.paymentIn.deleteMany({ where: { businessId } });
      await tx.paymentOut.deleteMany({ where: { businessId } });
      await tx.salesReturn.deleteMany({ where: { businessId } });
      await tx.deliveryChallan.deleteMany({ where: { businessId } });
      await tx.salesOrder.deleteMany({ where: { businessId } });
      await tx.bankingTransaction.deleteMany({ where: { businessId } });
      await tx.expense.deleteMany({ where: { businessId } });
      await tx.discount.deleteMany({ where: { businessId } });
      await tx.stockLedger.deleteMany({ where: { businessId } });
      await tx.item.deleteMany({ where: { businessId } });
      await tx.category.deleteMany({ where: { businessId } });
      await tx.unit.deleteMany({ where: { businessId } });
      await tx.bankAccount.deleteMany({ where: { businessId } });
      await tx.party.deleteMany({ where: { businessId } });

      // Populate data and preserve original primary keys (id)
      // Business profile
      if (data.business) {
        const { id, createdAt, updatedAt, ...bdata } = data.business;
        await tx.business.update({ where: { id: businessId }, data: bdata });
      }

      // Direct inserts preserving IDs
      if (data.parties && data.parties.length > 0) {
        await tx.party.createMany({
          data: data.parties.map(({ businessId: b, createdAt, updatedAt, ...x }) => ({ ...x, businessId })),
        });
      }
      if (data.categories && data.categories.length > 0) {
        await tx.category.createMany({
          data: data.categories.map(({ businessId: b, createdAt, updatedAt, ...x }) => ({ ...x, businessId })),
        });
      }
      if (data.units && data.units.length > 0) {
        await tx.unit.createMany({
          data: data.units.map(({ businessId: b, createdAt, updatedAt, ...x }) => ({ ...x, businessId })),
        });
      }
      if (data.items && data.items.length > 0) {
        await tx.item.createMany({
          data: data.items.map(({ businessId: b, createdAt, updatedAt, ...x }) => ({ ...x, businessId })),
        });
      }
      if (data.bankAccounts && data.bankAccounts.length > 0) {
        await tx.bankAccount.createMany({
          data: data.bankAccounts.map(({ businessId: b, createdAt, updatedAt, ...x }) => ({ ...x, businessId })),
        });
      }

      // Invoices / Transactions preserving IDs
      if (data.salesInvoices) {
        for (const inv of data.salesInvoices) {
          const { rows, businessId: b, createdAt, updatedAt, ...invData } = inv;
          await tx.salesInvoice.create({
            data: {
              ...invData,
              id: inv.id,
              businessId,
              rows: {
                create: rows.map(({ invoiceId, ...row }) => row),
              },
            },
          });
        }
      }

      if (data.purchaseInvoices) {
        for (const pinv of data.purchaseInvoices) {
          const { rows, businessId: b, createdAt, updatedAt, ...pinvData } = pinv;
          await tx.purchaseInvoice.create({
            data: {
              ...pinvData,
              id: pinv.id,
              businessId,
              rows: {
                create: rows.map(({ purchaseInvoiceId, ...row }) => row),
              },
            },
          });
        }
      }

      if (data.estimates) {
        for (const est of data.estimates) {
          const { rows, businessId: b, createdAt, updatedAt, ...estData } = est;
          await tx.estimate.create({
            data: {
              ...estData,
              id: est.id,
              businessId,
              rows: {
                create: rows.map(({ estimateId, ...row }) => row),
              },
            },
          });
        }
      }

      if (data.paymentsIn) {
        for (const pi of data.paymentsIn) {
          const { allocations, businessId: b, createdAt, updatedAt, ...piData } = pi;
          const newPi = await tx.paymentIn.create({ data: { ...piData, id: pi.id, businessId } });
          if (allocations && allocations.length > 0) {
            await tx.paymentInAllocation.createMany({
              data: allocations.map(({ paymentInId, ...alloc }) => ({ ...alloc, paymentInId: newPi.id })),
            });
          }
        }
      }

      if (data.paymentsOut) {
        for (const po of data.paymentsOut) {
          const { allocations, businessId: b, createdAt, updatedAt, ...poData } = po;
          const newPo = await tx.paymentOut.create({ data: { ...poData, id: po.id, businessId } });
          if (allocations && allocations.length > 0) {
            await tx.paymentOutAllocation.createMany({
              data: allocations.map(({ paymentOutId, ...alloc }) => ({ ...alloc, paymentOutId: newPo.id })),
            });
          }
        }
      }

      if (data.salesReturns) {
        for (const ret of data.salesReturns) {
          const { rows, businessId: b, createdAt, updatedAt, ...retData } = ret;
          await tx.salesReturn.create({
            data: {
              ...retData,
              id: ret.id,
              businessId,
              rows: {
                create: rows.map(({ salesReturnId, ...row }) => row),
              },
            },
          });
        }
      }

      if (data.deliveryChallans) {
        for (const chal of data.deliveryChallans) {
          const { rows, businessId: b, createdAt, updatedAt, ...chalData } = chal;
          await tx.deliveryChallan.create({
            data: {
              ...chalData,
              id: chal.id,
              businessId,
              rows: {
                create: rows.map(({ deliveryChallanId, ...row }) => row),
              },
            },
          });
        }
      }

      if (data.salesOrders) {
        for (const ord of data.salesOrders) {
          const { rows, businessId: b, createdAt, updatedAt, ...ordData } = ord;
          await tx.salesOrder.create({
            data: {
              ...ordData,
              id: ord.id,
              businessId,
              rows: {
                create: rows.map(({ salesOrderId, ...row }) => row),
              },
            },
          });
        }
      }

      if (data.bankingTransactions && data.bankingTransactions.length > 0) {
        await tx.bankingTransaction.createMany({
          data: data.bankingTransactions.map(({ businessId: b, createdAt, updatedAt, ...x }) => ({ ...x, businessId })),
        });
      }

      if (data.expenses && data.expenses.length > 0) {
        await tx.expense.createMany({
          data: data.expenses.map(({ businessId: b, createdAt, updatedAt, ...x }) => ({ ...x, businessId })),
        });
      }

      if (data.discounts && data.discounts.length > 0) {
        await tx.discount.createMany({
          data: data.discounts.map(({ businessId: b, createdAt, updatedAt, ...x }) => ({ ...x, businessId })),
        });
      }

      return { success: true };
    } finally {
      // Always re-enable foreign key checks at the end
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    }
  });
};

const backupService = {
  exportBackup,
  restoreBackup,
};

export { backupService };
export default backupService;
