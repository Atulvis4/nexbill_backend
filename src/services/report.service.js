import prisma from '../config/prisma.js';

const getDashboardSummary = async (businessId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Fetch all active parties with only basic balance metadata
  const parties = await prisma.party.findMany({
    where: { businessId, isArchived: false },
    select: { id: true, openingBalance: true, balanceType: true },
  });

  const partyIds = parties.map((p) => p.id);

  // Fetch aggregated values grouped by partyId using database SUM aggregations
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

  // Create fast lookup maps
  const salesMap = new Map(salesAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const purchaseMap = new Map(purchaseAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const paymentsInMap = new Map(paymentsInAgg.map((a) => [a.partyId, Number(a._sum.receivedAmount || 0)]));
  const paymentsOutMap = new Map(paymentsOutAgg.map((a) => [a.partyId, Number(a._sum.amount || 0)]));
  const salesReturnsMap = new Map(salesReturnsAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const purchaseReturnsMap = new Map(purchaseReturnsAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));

  let receivable = 0;
  let payable = 0;

  for (const party of parties) {
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

    if (netReceivable >= netPayable) {
      receivable += (netReceivable - netPayable);
    } else {
      payable += (netPayable - netReceivable);
    }
  }

  // Cash/Bank Balance
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { businessId },
    select: { currentBalance: true },
  });
  const cashBalance = bankAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);

  // Today's Sales
  const salesInvoicesToday = await prisma.salesInvoice.findMany({
    where: {
      businessId,
      isArchived: false,
      date: { gte: todayStart, lte: todayEnd },
    },
    select: { grandTotal: true },
  });
  const salesToday = salesInvoicesToday.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);

  // Today's Expenses
  const expenses = await prisma.expense.findMany({
    where: {
      businessId,
      date: { gte: todayStart, lte: todayEnd },
    },
    select: { amount: true },
  });
  const expensesToday = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  return {
    receivable,
    payable,
    cashBalance,
    salesToday,
    expensesToday,
  };
};

const getSalesTrend = async (businessId, days = 30) => {
  const result = [];
  const dailyTotals = {};

  // Initialize all days in the range with 0 to ensure continuous area chart rendering
  const today = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dailyTotals[dateStr] = 0;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const invoices = await prisma.salesInvoice.findMany({
    where: {
      businessId,
      isArchived: false,
      date: { gte: startDate },
    },
    select: { date: true, grandTotal: true },
  });

  for (const inv of invoices) {
    const dateStr = new Date(inv.date).toISOString().split('T')[0];
    if (dailyTotals[dateStr] !== undefined) {
      dailyTotals[dateStr] += Number(inv.grandTotal);
    }
  }

  const sortedDates = Object.keys(dailyTotals).sort();
  for (const date of sortedDates) {
    result.push({
      date,
      sales: dailyTotals[date],
    });
  }

  return result;
};

const getSalesReport = async (businessId, fromDate, toDate, partyId) => {
  const where = {
    businessId,
    isArchived: false,
  };

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setUTCHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  if (partyId) {
    where.partyId = parseInt(partyId, 10);
  }

  return await prisma.salesInvoice.findMany({
    where,
    include: { rows: true },
    orderBy: { date: 'desc' },
  });
};

const getPurchaseReport = async (businessId, fromDate, toDate, partyId) => {
  const where = {
    businessId,
    isArchived: false,
  };

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setUTCHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  if (partyId) {
    where.partyId = parseInt(partyId, 10);
  }

  return await prisma.purchaseInvoice.findMany({
    where,
    include: { rows: true },
    orderBy: { date: 'desc' },
  });
};

const getDaybookReport = async (businessId, date) => {
  const queryDate = date ? new Date(date) : new Date();
  const start = new Date(queryDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(queryDate);
  end.setUTCHours(23, 59, 59, 999);

  // Inflows (Money In)
  // Payments In (includes auto-payments from invoices)
  const paymentsIn = await prisma.paymentIn.findMany({
    where: { businessId, date: { gte: start, lte: end } },
    select: { receiptNo: true, receivedAmount: true, paymentMode: true },
  });

  // Outflows (Money Out)
  // 1. Payments Out (includes auto-payments from purchases)
  const paymentsOut = await prisma.paymentOut.findMany({
    where: { businessId, date: { gte: start, lte: end } },
    select: { paymentNo: true, amount: true, paymentMode: true },
  });

  // 2. Expenses
  const expenses = await prisma.expense.findMany({
    where: { businessId, date: { gte: start, lte: end } },
    select: { expenseCategoryName: true, amount: true, note: true },
  });

  const moneyIn = [
    ...paymentsIn.map((pi) => ({
      reference: pi.receiptNo,
      partyName: 'Customer Receipt',
      amount: Number(pi.receivedAmount),
      type: `Payment In (${pi.paymentMode})`,
    })),
  ];

  const moneyOut = [
    ...paymentsOut.map((po) => ({
      reference: po.paymentNo,
      partyName: 'Supplier Payment',
      amount: Number(po.amount),
      type: `Payment Out (${po.paymentMode})`,
    })),
    ...expenses.map((e) => ({
      reference: e.expenseCategoryName,
      partyName: e.note || 'General Expense',
      amount: Number(e.amount),
      type: 'Expense',
    })),
  ];

  return {
    date: start.toISOString().split('T')[0],
    moneyIn,
    moneyOut,
    totalIn: moneyIn.reduce((sum, item) => sum + item.amount, 0),
    totalOut: moneyOut.reduce((sum, item) => sum + item.amount, 0),
  };
};

const getStockSummaryReport = async (businessId, categoryId, lowStockOnly) => {
  const where = {
    businessId,
    type: 'PRODUCT',
    isArchived: false,
  };

  if (categoryId) {
    where.categoryId = parseInt(categoryId, 10);
  }

  const items = await prisma.item.findMany({
    where,
    include: { category: true },
  });

  let results = items.map((item) => ({
    id: item.id,
    name: item.name,
    itemCode: item.itemCode,
    category: item.category ? item.category.name : 'Uncategorized',
    stockQuantity: Number(item.stockQuantity),
    stockValue: Number(item.stockValue),
    minStock: Number(item.minStock),
    isLowStock: Number(item.stockQuantity) <= Number(item.minStock),
  }));

  if (lowStockOnly === 'true' || lowStockOnly === true) {
    results = results.filter((item) => item.isLowStock);
  }

  return results;
};

const getProfitLossReport = async (businessId, fromDate, toDate) => {
  const where = { businessId };
  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setUTCHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  // Sales Revenue
  const invoices = await prisma.salesInvoice.findMany({
    where: { ...where, isArchived: false },
    include: { rows: { include: { item: true } } },
  });

  const salesRevenue = invoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);

  // Compute Cost of Goods Sold (COGS) dynamically based on item purchase prices
  let cogs = 0;
  for (const inv of invoices) {
    for (const row of inv.rows) {
      if (row.item) {
        const multiplier = row.unitMultiplier ? Number(row.unitMultiplier) : 1;
        cogs += (Number(row.qty) / multiplier) * Number(row.item.purchasePrice);
      } else {
        // Fallback to row price - assuming 50% profit margin as default if no item link
        cogs += Number(row.total) * 0.5;
      }
    }
  }

  // Expenses
  const expensesList = await prisma.expense.findMany({ where });
  const totalExpenses = expensesList.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const grossProfit = salesRevenue - cogs;
  const netProfit = grossProfit - totalExpenses;

  return {
    salesRevenue,
    cogs,
    grossProfit,
    expenses: totalExpenses,
    netProfit,
  };
};

const getBalanceSheetReport = async (businessId) => {
  // Assets
  // 1. Bank balances
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { businessId },
    select: { currentBalance: true },
  });
  const bankCashBalance = bankAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);

  // 2. Receivables
  const invoices = await prisma.salesInvoice.findMany({
    where: { businessId, isArchived: false },
    select: { balance: true },
  });
  const accountsReceivable = invoices.reduce((sum, inv) => sum + Number(inv.balance), 0);

  // 3. Inventory Value
  const products = await prisma.item.findMany({
    where: { businessId, type: 'PRODUCT', isArchived: false },
    select: { stockValue: true },
  });
  const inventoryValue = products.reduce((sum, p) => sum + Number(p.stockValue), 0);

  // Liabilities
  // 1. Payables
  const purchaseInvoices = await prisma.purchaseInvoice.findMany({
    where: { businessId, isArchived: false },
    select: { balance: true },
  });
  const accountsPayable = purchaseInvoices.reduce((sum, pinv) => sum + Number(pinv.balance), 0);

  const totalAssets = bankCashBalance + accountsReceivable + inventoryValue;
  const totalLiabilities = accountsPayable;
  const equity = totalAssets - totalLiabilities;

  return {
    assets: {
      bankAndCash: bankCashBalance,
      receivables: accountsReceivable,
      inventoryValue,
      totalAssets,
    },
    liabilities: {
      payables: accountsPayable,
      totalLiabilities,
    },
    equity,
  };
};

const getGrowthSummary = async (businessId) => {
  const summary = await getDashboardSummary(businessId);

  // Calculate invoice collection rate
  const invoices = await prisma.salesInvoice.findMany({
    where: { businessId, isArchived: false },
    select: { grandTotal: true, paid: true },
  });

  const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + Number(inv.paid), 0);

  const collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 100;

  // Low stock products count
  const products = await prisma.item.findMany({
    where: { businessId, type: 'PRODUCT', isArchived: false },
    select: { stockQuantity: true, minStock: true },
  });
  const lowStockCount = products.filter(p => Number(p.stockQuantity) <= Number(p.minStock)).length;

  // Overdue parties count
  const overdueCount = await prisma.party.count({
    where: {
      businessId,
      isArchived: false,
      salesInvoices: {
        some: {
          isArchived: false,
          balance: { gt: 0 },
        },
      },
    },
  });

  return {
    todaySales: summary.salesToday,
    todayExpenses: summary.expensesToday,
    receivableOutstanding: summary.receivable,
    revenueCollected: totalCollected,
    netCapitalMargin: totalSales - totalCollected,
    receivableCollectionRate: collectionRate,
    lowStockCount,
    overduePartiesCount: overdueCount,
  };
};

const getOverdueParties = async (businessId) => {
  const parties = await prisma.party.findMany({
    where: {
      businessId,
      isArchived: false,
      salesInvoices: {
        some: {
          isArchived: false,
          balance: { gt: 0 },
        },
      },
    },
    include: {
      salesInvoices: {
        where: { isArchived: false, balance: { gt: 0 } },
        select: { balance: true },
      },
    },
  });

  return parties.map((party) => {
    const outstanding = party.salesInvoices.reduce((sum, inv) => sum + Number(inv.balance), 0);
    const template = `Hi ${party.partyName}, a friendly reminder that an amount of Rs. ${outstanding.toFixed(2)} is outstanding against your account. Please settle it at your earliest convenience.`;
    return {
      id: party.id,
      partyName: party.partyName,
      phone: party.phone,
      email: party.email,
      outstanding,
      whatsappTemplate: template,
    };
  });
};

// =========================================================================
// ANALYTICS: Top Performers
// =========================================================================

const getTopSellingItems = async (businessId, fromDate, toDate, limit = 10) => {
  const dateFilter = {};
  if (fromDate) dateFilter.gte = new Date(fromDate);
  if (toDate) {
    const end = new Date(toDate);
    end.setUTCHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const whereInvoice = {
    businessId,
    isArchived: false,
    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
  };

  // Fetch all non-archived sales invoices with their rows and item/category info
  const invoices = await prisma.salesInvoice.findMany({
    where: whereInvoice,
    select: {
      rows: {
        select: {
          itemId: true,
          itemName: true,
          qty: true,
          total: true,
          item: {
            select: {
              name: true,
              itemCode: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Aggregate by item
  const itemMap = {};
  for (const inv of invoices) {
    for (const row of inv.rows) {
      const key = row.itemId != null ? `id_${row.itemId}` : `name_${row.itemName}`;
      if (!itemMap[key]) {
        itemMap[key] = {
          itemId: row.itemId,
          itemName: row.item?.name || row.itemName || 'Unknown Item',
          itemCode: row.item?.itemCode || '',
          category: row.item?.category?.name || '',
          totalQty: 0,
          totalRevenue: 0,
          invoiceCount: 0,
        };
      }
      itemMap[key].totalQty += Number(row.qty);
      itemMap[key].totalRevenue += Number(row.total);
      itemMap[key].invoiceCount += 1;
    }
  }

  const sorted = Object.values(itemMap)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, Number(limit));

  return sorted;
};

const getTopCustomerParties = async (businessId, fromDate, toDate, limit = 10) => {
  const dateFilter = {};
  if (fromDate) dateFilter.gte = new Date(fromDate);
  if (toDate) {
    const end = new Date(toDate);
    end.setUTCHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const whereInvoice = {
    businessId,
    isArchived: false,
    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
  };

  const invoices = await prisma.salesInvoice.findMany({
    where: whereInvoice,
    select: {
      partyId: true,
      partyName: true,
      phone: true,
      grandTotal: true,
    },
  });

  // Aggregate by party
  const partyMap = {};
  for (const inv of invoices) {
    const key = inv.partyId != null ? `id_${inv.partyId}` : `name_${inv.partyName}`;
    if (!partyMap[key]) {
      partyMap[key] = {
        partyId: inv.partyId,
        partyName: inv.partyName || 'Walk-in Customer',
        phone: inv.phone || '',
        totalBusiness: 0,
        invoiceCount: 0,
      };
    }
    partyMap[key].totalBusiness += Number(inv.grandTotal);
    partyMap[key].invoiceCount += 1;
  }

  const sorted = Object.values(partyMap)
    .sort((a, b) => b.totalBusiness - a.totalBusiness)
    .slice(0, Number(limit));

  return sorted;
};

const getTopSupplierParties = async (businessId, fromDate, toDate, limit = 10) => {
  const dateFilter = {};
  if (fromDate) dateFilter.gte = new Date(fromDate);
  if (toDate) {
    const end = new Date(toDate);
    end.setUTCHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const whereInvoice = {
    businessId,
    isArchived: false,
    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
  };

  const invoices = await prisma.purchaseInvoice.findMany({
    where: whereInvoice,
    select: {
      partyId: true,
      partyName: true,
      phone: true,
      grandTotal: true,
    },
  });

  // Aggregate by party
  const partyMap = {};
  for (const inv of invoices) {
    const key = inv.partyId != null ? `id_${inv.partyId}` : `name_${inv.partyName}`;
    if (!partyMap[key]) {
      partyMap[key] = {
        partyId: inv.partyId,
        partyName: inv.partyName || 'Unknown Supplier',
        phone: inv.phone || '',
        totalBusiness: 0,
        invoiceCount: 0,
      };
    }
    partyMap[key].totalBusiness += Number(inv.grandTotal);
    partyMap[key].invoiceCount += 1;
  }

  const sorted = Object.values(partyMap)
    .sort((a, b) => b.totalBusiness - a.totalBusiness)
    .slice(0, Number(limit));

  return sorted;
};

const reportService = {
  getDashboardSummary,
  getSalesTrend,
  getSalesReport,
  getPurchaseReport,
  getDaybookReport,
  getStockSummaryReport,
  getProfitLossReport,
  getBalanceSheetReport,
  getGrowthSummary,
  getOverdueParties,
  getTopSellingItems,
  getTopCustomerParties,
  getTopSupplierParties,
};

export { reportService };
export default reportService;
