import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

// Helper to compute dynamic outstanding balance for a single party
const calculatePartyBalance = async (party) => {
  const salesInvoices = await prisma.salesInvoice.findMany({
    where: { partyId: party.id, isArchived: false },
    select: { grandTotal: true },
  });

  const purchaseInvoices = await prisma.purchaseInvoice.findMany({
    where: { partyId: party.id, isArchived: false },
    select: { grandTotal: true },
  });

  const paymentsIn = await prisma.paymentIn.findMany({
    where: { partyId: party.id },
    select: { receivedAmount: true },
  });

  const paymentsOut = await prisma.paymentOut.findMany({
    where: { partyId: party.id },
    select: { amount: true },
  });

  const salesReturns = await prisma.salesReturn.findMany({
    where: { partyId: party.id },
    select: { grandTotal: true },
  });

  const purchaseReturns = await prisma.purchaseReturn.findMany({
    where: { partyId: party.id },
    select: { grandTotal: true },
  }).catch(() => []);

  const totalSales = salesInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
  const totalPurchases = purchaseInvoices.reduce((sum, pinv) => sum + Number(pinv.grandTotal), 0);
  const totalPaymentsIn = paymentsIn.reduce((sum, p) => sum + Number(p.receivedAmount), 0);
  const totalPaymentsOut = paymentsOut.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalSalesReturns = salesReturns.reduce((sum, r) => sum + Number(r.grandTotal), 0);
  const totalPurchaseReturns = purchaseReturns.reduce((sum, r) => sum + Number(r.grandTotal), 0);

  let netReceivable = 0;
  let netPayable = 0;

  // Add opening balance
  if (party.balanceType === 'RECEIVABLE') {
    netReceivable += Number(party.openingBalance);
  } else if (party.balanceType === 'PAYABLE') {
    netPayable += Number(party.openingBalance);
  }

  // Receivables: Opening (RECEIVABLE) + Sales - Payments In - Sales Returns
  netReceivable += (totalSales - totalPaymentsIn - totalSalesReturns);

  // Payables: Opening (PAYABLE) + Purchases - Payments Out - Purchase Returns
  netPayable += (totalPurchases - totalPaymentsOut - totalPurchaseReturns);

  let outstanding;
  let balanceType;

  if (netReceivable >= netPayable) {
    outstanding = netReceivable - netPayable;
    balanceType = 'RECEIVABLE';
  } else {
    outstanding = netPayable - netReceivable;
    balanceType = 'PAYABLE';
  }

  return {
    ...party,
    outstanding,
    balanceType,
  };
};

const listParties = async (businessId, options = {}) => {
  const {
    search,
    balanceType,
    sortByAmount,     // backward-compat
    sortBy = 'name',  // 'name' | 'amount'
    sortOrder = 'asc',
    minAmount,
    maxAmount,
    state,
  } = typeof options === 'string' ? { search: options } : options;

  const where = {
    businessId,
    isArchived: false,
  };

  if (search) {
    where.OR = [
      { partyName: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  // State filter at DB level
  if (state) {
    where.state = { contains: state };
  }

  // DB-level ordering for name sort; amount sort is done in-memory after outstanding is computed
  const dbOrderBy = sortBy === 'name'
    ? { partyName: sortOrder === 'desc' ? 'desc' : 'asc' }
    : { partyName: 'asc' };

  const parties = await prisma.party.findMany({
    where,
    orderBy: dbOrderBy,
  });

  const partyIds = parties.map((p) => p.id);

  // Group-by aggregates for all active parties
  const salesAgg = await prisma.salesInvoice.groupBy({
    by: ['partyId'],
    where: { partyId: { in: partyIds }, isArchived: false },
    _sum: { grandTotal: true },
  });

  const purchaseAgg = await prisma.purchaseInvoice.groupBy({
    by: ['partyId'],
    where: { partyId: { in: partyIds }, isArchived: false },
    _sum: { grandTotal: true },
  });

  const paymentsInAgg = await prisma.paymentIn.groupBy({
    by: ['partyId'],
    where: { partyId: { in: partyIds } },
    _sum: { receivedAmount: true },
  });

  const paymentsOutAgg = await prisma.paymentOut.groupBy({
    by: ['partyId'],
    where: { partyId: { in: partyIds } },
    _sum: { amount: true },
  });

  const salesReturnsAgg = await prisma.salesReturn.groupBy({
    by: ['partyId'],
    where: { partyId: { in: partyIds } },
    _sum: { grandTotal: true },
  });

  const purchaseReturnsAgg = await prisma.purchaseReturn.groupBy({
    by: ['partyId'],
    where: { partyId: { in: partyIds } },
    _sum: { grandTotal: true },
  });

  // Fast lookups
  const salesMap = new Map(salesAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const purchaseMap = new Map(purchaseAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const paymentsInMap = new Map(paymentsInAgg.map((a) => [a.partyId, Number(a._sum.receivedAmount || 0)]));
  const paymentsOutMap = new Map(paymentsOutAgg.map((a) => [a.partyId, Number(a._sum.amount || 0)]));
  const salesReturnsMap = new Map(salesReturnsAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const purchaseReturnsMap = new Map(purchaseReturnsAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));

  // Map and compute the balances in memory
  let mappedParties = parties.map((party) => {
    const totalSales = salesMap.get(party.id) || 0;
    const totalPurchases = purchaseMap.get(party.id) || 0;
    const totalPaymentsIn = paymentsInMap.get(party.id) || 0;
    const totalPaymentsOut = paymentsOutMap.get(party.id) || 0;
    const totalSalesReturns = salesReturnsMap.get(party.id) || 0;
    const totalPurchaseReturns = purchaseReturnsMap.get(party.id) || 0;

    let netReceivable = 0;
    let netPayable = 0;

    if (party.balanceType === 'RECEIVABLE') {
      netReceivable += Number(party.openingBalance);
    } else if (party.balanceType === 'PAYABLE') {
      netPayable += Number(party.openingBalance);
    }

    netReceivable += (totalSales - totalPaymentsIn - totalSalesReturns);
    netPayable += (totalPurchases - totalPaymentsOut - totalPurchaseReturns);

    const outstanding = netReceivable >= netPayable ? netReceivable - netPayable : netPayable - netReceivable;
    const computedBalanceType = netReceivable >= netPayable ? 'RECEIVABLE' : 'PAYABLE';

    return {
      ...party,
      outstanding,
      balanceType: computedBalanceType,
    };
  });

  if (balanceType) {
    mappedParties = mappedParties.filter(
      (p) => p.balanceType === balanceType && p.outstanding > 0
    );
  }

  // Amount range filter (in-memory after outstanding is computed)
  if (minAmount !== undefined && minAmount !== '' && !isNaN(Number(minAmount))) {
    mappedParties = mappedParties.filter((p) => Number(p.outstanding) >= Number(minAmount));
  }
  if (maxAmount !== undefined && maxAmount !== '' && !isNaN(Number(maxAmount))) {
    mappedParties = mappedParties.filter((p) => Number(p.outstanding) <= Number(maxAmount));
  }

  // Sort by amount if requested (in-memory); name sort was already done at DB level
  if (sortBy === 'amount') {
    mappedParties.sort((a, b) =>
      sortOrder === 'desc' ? b.outstanding - a.outstanding : a.outstanding - b.outstanding
    );
  } else if (sortByAmount === 'desc') {
    mappedParties.sort((a, b) => b.outstanding - a.outstanding);
  } else if (sortByAmount === 'asc') {
    mappedParties.sort((a, b) => a.outstanding - b.outstanding);
  }

  return mappedParties;
};

const createParty = async (businessId, data) => {
  const party = await prisma.party.create({
    data: {
      ...data,
      businessId,
    },
  });
  return await calculatePartyBalance(party);
};

const getParty = async (businessId, id) => {
  const party = await prisma.party.findFirst({
    where: { id, businessId, isArchived: false },
  });

  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }

  return await calculatePartyBalance(party);
};

const updateParty = async (businessId, id, data) => {
  // Ensure party exists
  await getParty(businessId, id);

  const updated = await prisma.party.update({
    where: { id },
    data,
  });

  return await calculatePartyBalance(updated);
};

const deleteParty = async (businessId, id) => {
  await getParty(businessId, id);

  await prisma.party.update({
    where: { id },
    data: { isArchived: true },
  });

  return { success: true };
};

const getPartyLedger = async (businessId, id, query = {}) => {
  const { startDate, endDate } = query;

  const party = await prisma.party.findFirst({
    where: { id, businessId, isArchived: false },
  });

  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }

  // Define prisma where condition for date range
  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const invoices = await prisma.salesInvoice.findMany({
    where: { partyId: id, isArchived: false, ...(startDate || endDate ? { date: dateFilter } : {}) },
    select: {
      id: true, invoiceNo: true, date: true, grandTotal: true, balance: true, description: true,
      rows: { select: { itemName: true, hsn: true, qty: true, box: true, unit: true, price: true, taxRate: true, taxAmount: true, total: true } },
    },
  });

  const purchases = await prisma.purchaseInvoice.findMany({
    where: { partyId: id, isArchived: false, ...(startDate || endDate ? { date: dateFilter } : {}) },
    select: {
      id: true, billNo: true, date: true, grandTotal: true, balance: true, description: true,
      rows: { select: { itemName: true, hsn: true, qty: true, box: true, unit: true, price: true, taxRate: true, taxAmount: true, total: true } },
    },
  });

  const paymentsIn = await prisma.paymentIn.findMany({
    where: { partyId: id, ...(startDate || endDate ? { date: dateFilter } : {}) },
    select: { 
      id: true, 
      receiptNo: true, 
      date: true, 
      receivedAmount: true, 
      paymentMode: true,
      allocations: {
        select: {
          amount: true,
          invoice: {
            select: {
              invoiceNo: true
            }
          }
        }
      }
    },
  });

  const paymentsOut = await prisma.paymentOut.findMany({
    where: { partyId: id, ...(startDate || endDate ? { date: dateFilter } : {}) },
    select: { 
      id: true, 
      paymentNo: true, 
      date: true, 
      amount: true, 
      paymentMode: true,
      allocations: {
        select: {
          amount: true,
          purchaseInvoice: {
            select: {
              billNo: true
            }
          }
        }
      }
    },
  });

  const salesReturns = await prisma.salesReturn.findMany({
    where: { partyId: id, ...(startDate || endDate ? { date: dateFilter } : {}) },
    select: { id: true, returnNo: true, date: true, grandTotal: true, returnType: true },
  });

  const purchaseReturns = await prisma.purchaseReturn.findMany({
    where: { partyId: id, ...(startDate || endDate ? { date: dateFilter } : {}) },
    select: { id: true, returnNo: true, date: true, grandTotal: true, returnType: true },
  }).catch(() => []);

  // Calculate prior transactions to establish the opening balance for the statement
  let priorReceivable = 0;
  let priorPayable = 0;

  if (party.balanceType === 'RECEIVABLE') {
    priorReceivable += Number(party.openingBalance);
  } else if (party.balanceType === 'PAYABLE') {
    priorPayable += Number(party.openingBalance);
  }

  if (startDate) {
    const startLimit = new Date(startDate);
    const priorInvoices = await prisma.salesInvoice.findMany({
      where: { partyId: id, isArchived: false, date: { lt: startLimit } },
      select: { grandTotal: true },
    });
    const priorPurchases = await prisma.purchaseInvoice.findMany({
      where: { partyId: id, isArchived: false, date: { lt: startLimit } },
      select: { grandTotal: true },
    });
    const priorPaymentsIn = await prisma.paymentIn.findMany({
      where: { partyId: id, date: { lt: startLimit } },
      select: { receivedAmount: true },
    });
    const priorPaymentsOut = await prisma.paymentOut.findMany({
      where: { partyId: id, date: { lt: startLimit } },
      select: { amount: true },
    });
    const priorReturns = await prisma.salesReturn.findMany({
      where: { partyId: id, date: { lt: startLimit } },
      select: { grandTotal: true },
    });
    const priorPurchaseReturns = await prisma.purchaseReturn.findMany({
      where: { partyId: id, date: { lt: startLimit } },
      select: { grandTotal: true },
    }).catch(() => []);

    const sumPriorInvoices = priorInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
    const sumPriorPurchases = priorPurchases.reduce((sum, p) => sum + Number(p.grandTotal), 0);
    const sumPriorPaymentsIn = priorPaymentsIn.reduce((sum, pi) => sum + Number(pi.receivedAmount), 0);
    const sumPriorPaymentsOut = priorPaymentsOut.reduce((sum, po) => sum + Number(po.amount), 0);
    const sumPriorReturns = priorReturns.reduce((sum, r) => sum + Number(r.grandTotal), 0);
    const sumPriorPurchaseReturns = priorPurchaseReturns.reduce((sum, r) => sum + Number(r.grandTotal), 0);

    priorReceivable += (sumPriorInvoices - sumPriorPaymentsIn - sumPriorReturns);
    priorPayable += (sumPriorPurchases - sumPriorPaymentsOut - sumPriorPurchaseReturns);
  }

  let openingBalanceValue;
  let openingBalanceType;

  if (priorReceivable >= priorPayable) {
    openingBalanceValue = priorReceivable - priorPayable;
    openingBalanceType = 'RECEIVABLE';
  } else {
    openingBalanceValue = priorPayable - priorReceivable;
    openingBalanceType = 'PAYABLE';
  }

  // Format and merge ledger entries
  const ledger = [
    ...invoices.map((i) => ({
      id: i.id,
      date: i.date,
      type: 'Sales Invoice',
      referenceNo: i.invoiceNo,
      amount: Number(i.grandTotal),
      balance: Number(i.balance),
      effect: 'RECEIVABLE_UP',
      description: i.description || null,
      rows: (i.rows || []).map(r => ({
        itemName: r.itemName,
        hsn: r.hsn || '',
        qty: Number(r.qty),
        box: r.box || null,
        unit: r.unit || '',
        price: Number(r.price),
        taxRate: Number(r.taxRate),
        taxAmount: Number(r.taxAmount),
        total: Number(r.total),
      })),
    })),
    ...purchases.map((p) => ({
      id: p.id,
      date: p.date,
      type: 'Purchase Invoice',
      referenceNo: p.billNo,
      amount: Number(p.grandTotal),
      balance: Number(p.balance),
      effect: 'PAYABLE_UP',
      description: p.description || null,
      rows: (p.rows || []).map(r => ({
        itemName: r.itemName,
        hsn: r.hsn || '',
        qty: Number(r.qty),
        box: r.box || null,
        unit: r.unit || '',
        price: Number(r.price),
        taxRate: Number(r.taxRate),
        taxAmount: Number(r.taxAmount),
        total: Number(r.total),
      })),
    })),
    ...paymentsIn.map((pi) => ({
      id: pi.id,
      date: pi.date,
      type: 'Payment In',
      referenceNo: pi.receiptNo,
      amount: Number(pi.receivedAmount),
      detail: pi.paymentMode,
      effect: 'RECEIVABLE_DOWN',
      allocations: pi.allocations.map(a => ({
        amount: Number(a.amount),
        invoiceNo: a.invoice?.invoiceNo
      }))
    })),
    ...paymentsOut.map((po) => ({
      id: po.id,
      date: po.date,
      type: 'Payment Out',
      referenceNo: po.paymentNo,
      amount: Number(po.amount),
      detail: po.paymentMode,
      effect: 'PAYABLE_DOWN',
      allocations: po.allocations.map(a => ({
        amount: Number(a.amount),
        billNo: a.purchaseInvoice?.billNo
      }))
    })),
    ...salesReturns.map((r) => ({
      id: r.id,
      date: r.date,
      type: `Sales Return (${r.returnType})`,
      referenceNo: r.returnNo,
      amount: Number(r.grandTotal),
      effect: 'RECEIVABLE_DOWN',
    })),
    ...purchaseReturns.map((r) => ({
      id: r.id,
      date: r.date,
      type: `Purchase Return (${r.returnType})`,
      referenceNo: r.returnNo,
      amount: Number(r.grandTotal),
      effect: 'PAYABLE_DOWN',
    })),
  ];

  // Sort by date descending
  ledger.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    party,
    openingBalance: {
      amount: openingBalanceValue,
      balanceType: openingBalanceType,
    },
    ledger,
  };
};

const getPartyBalance = async (businessId, id) => {
  const party = await getParty(businessId, id);
  return {
    outstanding: party.outstanding,
    balanceType: party.balanceType,
  };
};

const partyService = {
  listParties,
  createParty,
  getParty,
  updateParty,
  deleteParty,
  getPartyLedger,
  getPartyBalance,
};

export { partyService };
export default partyService;
