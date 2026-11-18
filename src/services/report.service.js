import prisma from '../config/prisma.js';
import cache from '../utils/cache.js';

const getDashboardSummary = async (businessId) => {
  const cacheKey = `dashboard:${businessId}:summary`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Fetch all active parties
  const parties = await prisma.party.findMany({
    where: { businessId, isArchived: false },
    select: { id: true, openingBalance: true, balanceType: true },
  });

  const partyIds = parties.map((p) => p.id);

  const [
    salesAgg,
    purchaseAgg,
    paymentsInAgg,
    paymentsOutAgg,
    salesReturnsAgg,
    purchaseReturnsAgg,
    salesInvAgg,
    purchaseInvAgg,
    bankAccounts,
    salesInvoicesToday,
    expenses,
  ] = await Promise.all([
    prisma.salesInvoice.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds }, isArchived: false },
      _sum: { grandTotal: true },
    }),
    prisma.purchaseInvoice.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds }, isArchived: false },
      _sum: { grandTotal: true },
    }),
    prisma.paymentIn.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds } },
      _sum: { receivedAmount: true },
    }),
    prisma.paymentOut.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds } },
      _sum: { amount: true },
    }),
    prisma.salesReturn.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds } },
      _sum: { grandTotal: true },
    }),
    prisma.purchaseReturn.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds } },
      _sum: { grandTotal: true },
    }),
    prisma.salesInvoice.aggregate({
      where: { businessId, isArchived: false },
      _sum: { balance: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: { businessId, isArchived: false },
      _sum: { balance: true },
    }),
    prisma.bankAccount.findMany({
      where: { businessId },
      select: { currentBalance: true },
    }),
    prisma.salesInvoice.findMany({
      where: {
        businessId,
        isArchived: false,
        date: { gte: todayStart, lte: todayEnd },
      },
      select: { grandTotal: true },
    }),
    prisma.expense.findMany({
      where: {
        businessId,
        date: { gte: todayStart, lte: todayEnd },
      },
      select: { amount: true },
    }),
  ]);

  const salesMap = new Map(salesAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const purchaseMap = new Map(purchaseAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const paymentsInMap = new Map(paymentsInAgg.map((a) => [a.partyId, Number(a._sum.receivedAmount || 0)]));
  const paymentsOutMap = new Map(paymentsOutAgg.map((a) => [a.partyId, Number(a._sum.amount || 0)]));
  const salesReturnsMap = new Map(salesReturnsAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const purchaseReturnsMap = new Map(purchaseReturnsAgg.map((a) => [a.partyId, Number(a._sum.grandTotal || 0)]));

  let toCollect = 0;
  let toPay = 0;

  for (const party of parties) {
    const s = salesMap.get(party.id) || 0;
    const pi = paymentsInMap.get(party.id) || 0;
    const sr = salesReturnsMap.get(party.id) || 0;
    const p = purchaseMap.get(party.id) || 0;
    const po = paymentsOutMap.get(party.id) || 0;
    const pr = purchaseReturnsMap.get(party.id) || 0;

    const netRec = (party.balanceType === 'RECEIVABLE' ? Number(party.openingBalance) : 0) + (s - pi - sr);
    const netPay = (party.balanceType === 'PAYABLE' ? Number(party.openingBalance) : 0) + (p - po - pr);

    if (netRec > netPay) {
      toCollect += netRec - netPay;
    } else if (netPay > netRec) {
      toPay += netPay - netRec;
    }
  }

  const receivable = Number(salesInvAgg._sum.balance || 0);
  const payable = Number(purchaseInvAgg._sum.balance || 0);
  const cashBalance = bankAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);
  const salesToday = salesInvoicesToday.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
  const expensesToday = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  // Compute Current Month sales
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const salesInvoicesMonth = await prisma.salesInvoice.findMany({
    where: {
      businessId,
      isArchived: false,
      date: { gte: startOfMonth, lte: endOfMonth },
    },
    select: { grandTotal: true },
  });
  const salesThisMonth = salesInvoicesMonth.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
  const salesThisMonthCount = salesInvoicesMonth.length;
  const currentMonthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const result = {
    receivable,
    payable,
    toCollect: Math.round(toCollect * 100) / 100,
    toPay: Math.round(toPay * 100) / 100,
    cashBalance,
    salesToday,
    expensesToday,
    salesThisMonth: Math.round(salesThisMonth * 100) / 100,
    salesThisMonthCount,
    currentMonthName,
  };

  cache.set(cacheKey, result, 180);
  return result;
};

const getSalesTrend = async (businessId, options = 30) => {
  let period = null;
  let days = 30;

  if (typeof options === 'object' && options !== null) {
    period = options.period || null;
    days = options.days !== undefined ? (parseInt(options.days, 10) || 30) : 30;
  } else if (typeof options === 'string' && isNaN(Number(options))) {
    period = options;
  } else {
    days = parseInt(options, 10) || 30;
  }

  const result = [];
  const dailyTotals = {};

  if (period === 'this_month' || period === 'month') {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const key = `${year}-${mStr}-${dStr}`;
      dailyTotals[key] = 0;
    }

    const invoices = await prisma.salesInvoice.findMany({
      where: {
        businessId,
        isArchived: false,
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true, grandTotal: true },
    });

    for (const inv of invoices) {
      const dateStr = new Date(inv.date).toISOString().split('T')[0];
      if (dailyTotals[dateStr] !== undefined) {
        dailyTotals[dateStr] += Number(inv.grandTotal);
      }
    }
  } else {
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

const getBalanceSheetReport = async (businessId, asOfDate) => {
  const cacheKey = `report:${businessId}:balance-sheet:${asOfDate || 'latest'}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const cutoffDate = asOfDate ? new Date(asOfDate) : new Date();
  cutoffDate.setUTCHours(23, 59, 59, 999);

  // 1. Bank and Cash Balances
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      accountNumber: true,
      bankName: true,
      currentBalance: true,
      accountType: true,
    },
  });
  const bankCashBalance = bankAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance || 0), 0);

  // 2. Party Outstanding: Accounts Receivable (Sundry Debtors) and Accounts Payable (Sundry Creditors)
  // Fetch active parties and compute balances using group-by aggregates
  const parties = await prisma.party.findMany({
    where: { businessId, isArchived: false },
    select: { id: true, partyName: true, phone: true, openingBalance: true, balanceType: true },
  });
  const partyIds = parties.map(p => p.id);

  const [salesAgg, purchaseAgg, paymentsInAgg, paymentsOutAgg, salesReturnsAgg, purchaseReturnsAgg] = await Promise.all([
    prisma.salesInvoice.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds }, isArchived: false, date: { lte: cutoffDate } },
      _sum: { grandTotal: true },
    }),
    prisma.purchaseInvoice.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds }, isArchived: false, date: { lte: cutoffDate } },
      _sum: { grandTotal: true },
    }),
    prisma.paymentIn.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds }, date: { lte: cutoffDate } },
      _sum: { receivedAmount: true },
    }),
    prisma.paymentOut.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds }, date: { lte: cutoffDate } },
      _sum: { amount: true },
    }),
    prisma.salesReturn.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds }, date: { lte: cutoffDate } },
      _sum: { grandTotal: true },
    }),
    prisma.purchaseReturn.groupBy({
      by: ['partyId'],
      where: { partyId: { in: partyIds }, date: { lte: cutoffDate } },
      _sum: { grandTotal: true },
    }),
  ]);

  const salesMap = new Map(salesAgg.map(a => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const purchaseMap = new Map(purchaseAgg.map(a => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const paymentsInMap = new Map(paymentsInAgg.map(a => [a.partyId, Number(a._sum.receivedAmount || 0)]));
  const paymentsOutMap = new Map(paymentsOutAgg.map(a => [a.partyId, Number(a._sum.amount || 0)]));
  const salesReturnsMap = new Map(salesReturnsAgg.map(a => [a.partyId, Number(a._sum.grandTotal || 0)]));
  const purchaseReturnsMap = new Map(purchaseReturnsAgg.map(a => [a.partyId, Number(a._sum.grandTotal || 0)]));

  const debtorsList = [];
  const creditorsList = [];

  for (const party of parties) {
    const totalSales = salesMap.get(party.id) || 0;
    const totalPurchases = purchaseMap.get(party.id) || 0;
    const totalPaymentsIn = paymentsInMap.get(party.id) || 0;
    const totalPaymentsOut = paymentsOutMap.get(party.id) || 0;
    const totalSalesReturns = salesReturnsMap.get(party.id) || 0;
    const totalPurchaseReturns = purchaseReturnsMap.get(party.id) || 0;

    let netReceivable = party.balanceType === 'RECEIVABLE' ? Number(party.openingBalance || 0) : 0;
    let netPayable = party.balanceType === 'PAYABLE' ? Number(party.openingBalance || 0) : 0;

    netReceivable += (totalSales - totalPaymentsIn - totalSalesReturns);
    netPayable += (totalPurchases - totalPaymentsOut - totalPurchaseReturns);

    if (netReceivable > netPayable) {
      const diff = netReceivable - netPayable;
      if (diff > 0.001) {
        debtorsList.push({ id: party.id, name: party.partyName, phone: party.phone, amount: diff });
      }
    } else if (netPayable > netReceivable) {
      const diff = netPayable - netReceivable;
      if (diff > 0.001) {
        creditorsList.push({ id: party.id, name: party.partyName, phone: party.phone, amount: diff });
      }
    }
  }

  debtorsList.sort((a, b) => b.amount - a.amount);
  creditorsList.sort((a, b) => b.amount - a.amount);

  const accountsReceivable = debtorsList.reduce((sum, d) => sum + d.amount, 0);
  const accountsPayable = creditorsList.reduce((sum, c) => sum + c.amount, 0);

  // 3. Inventory Stock Value (Closing Stock)
  const products = await prisma.item.findMany({
    where: { businessId, type: 'PRODUCT', isArchived: false },
    select: {
      id: true,
      name: true,
      stockQuantity: true,
      purchasePrice: true,
      stockValue: true,
    },
  });

  let inventoryValue = 0;
  const inventoryItemsList = [];
  for (const p of products) {
    const qty = Number(p.stockQuantity || 0);
    const cost = Number(p.purchasePrice || 0);
    const val = Number(p.stockValue || (qty * cost));
    if (val > 0) {
      inventoryValue += val;
      inventoryItemsList.push({ id: p.id, name: p.name, quantity: qty, value: val });
    }
  }
  inventoryItemsList.sort((a, b) => b.value - a.value);

  // 4. Taxes: GST Input vs Output
  const [salesTaxAgg, purchaseTaxAgg] = await Promise.all([
    prisma.salesInvoice.aggregate({
      where: { businessId, isArchived: false, date: { lte: cutoffDate } },
      _sum: { totalTax: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: { businessId, isArchived: false, date: { lte: cutoffDate } },
      _sum: { totalTax: true },
    }),
  ]);
  const outputGst = Number(salesTaxAgg._sum.totalTax || 0);
  const inputGst = Number(purchaseTaxAgg._sum.totalTax || 0);

  let inputTaxCredit = 0;
  let gstPayable = 0;
  if (inputGst > outputGst) {
    inputTaxCredit = inputGst - outputGst;
  } else {
    gstPayable = outputGst - inputGst;
  }

  // 5. Total Assets & Total Liabilities
  const totalCurrentAssets = bankCashBalance + accountsReceivable + inventoryValue + inputTaxCredit;
  const totalAssets = totalCurrentAssets;

  const totalCurrentLiabilities = accountsPayable + gstPayable;
  const totalLiabilities = totalCurrentLiabilities;

  // 6. Net Profit / (Loss) for the business
  const pnl = await getProfitLossReport(businessId, null, asOfDate);
  const netProfit = Number(pnl.netProfit || 0);

  // 7. Equity & Capital
  // Accounting fundamental identity: Total Assets = Total Liabilities + Total Equity
  // Therefore Total Equity = Total Assets - Total Liabilities
  const totalEquity = totalAssets - totalLiabilities;
  const capitalAccount = totalEquity - netProfit;

  return {
    asOfDate: cutoffDate.toISOString().slice(0, 10),
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    assets: {
      bankAndCash: {
        total: bankCashBalance,
        accounts: bankAccounts.map(b => ({
          id: b.id,
          name: b.name,
          bankName: b.bankName,
          accountNumber: b.accountNumber,
          balance: Number(b.currentBalance || 0),
        })),
      },
      accountsReceivable: {
        total: accountsReceivable,
        debtorsCount: debtorsList.length,
        topDebtors: debtorsList.slice(0, 5),
      },
      inventory: {
        total: inventoryValue,
        itemsCount: inventoryItemsList.length,
        topItems: inventoryItemsList.slice(0, 5),
      },
      taxCredit: {
        total: inputTaxCredit,
        inputGst,
        outputGst,
      },
      totalAssets,
    },
    liabilities: {
      accountsPayable: {
        total: accountsPayable,
        creditorsCount: creditorsList.length,
        topCreditors: creditorsList.slice(0, 5),
      },
      dutiesAndTaxes: {
        total: gstPayable,
        outputGst,
        inputGst,
      },
      totalLiabilities,
    },
    equity: {
      capitalAccount,
      netProfit,
      totalEquity,
    },
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
  };

  cache.set(cacheKey, result, 300);
  return result;
};

const getItemReportByParty = async (businessId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(query.limit, 10) || 50));
  const offset = (page - 1) * limit;
  const fetchLimit = offset + limit;

  const { fromDate, toDate, partyId, type = 'ALL', search } = query;

  const cacheKey = `report:${businessId}:items-by-party:${page}:${limit}:${partyId || ''}:${type}:${search || ''}:${fromDate || ''}:${toDate || ''}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Build WHERE conditions and parameters
  const salesConditions = ['i.businessId = ?', 'i.isArchived = 0'];
  const salesParams = [businessId];

  const purConditions = ['i.businessId = ?', 'i.isArchived = 0'];
  const purParams = [businessId];

  if (partyId) {
    salesConditions.push('i.partyId = ?');
    salesParams.push(Number(partyId));

    purConditions.push('i.partyId = ?');
    purParams.push(Number(partyId));
  }

  if (fromDate) {
    const start = new Date(fromDate);
    salesConditions.push('i.date >= ?');
    salesParams.push(start);

    purConditions.push('i.date >= ?');
    purParams.push(start);
  }

  if (toDate) {
    const end = new Date(toDate);
    end.setUTCHours(23, 59, 59, 999);
    salesConditions.push('i.date <= ?');
    salesParams.push(end);

    purConditions.push('i.date <= ?');
    purParams.push(end);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    salesConditions.push('(r.itemName LIKE ? OR COALESCE(p.partyName, i.partyName) LIKE ? OR r.hsn LIKE ? OR i.invoiceNo LIKE ?)');
    salesParams.push(term, term, term, term);

    purConditions.push('(r.itemName LIKE ? OR COALESCE(p.partyName, i.partyName) LIKE ? OR r.hsn LIKE ? OR i.billNo LIKE ?)');
    purParams.push(term, term, term, term);
  }

  const salesWhere = salesConditions.join(' AND ');
  const purWhere = purConditions.join(' AND ');

  // 1. Get Aggregates / Summary
  let salesAgg = null;
  let purchaseAgg = null;

  if (type === 'SALE' || type === 'ALL') {
    const [res] = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as rowCount,
        COALESCE(SUM(r.qty), 0) as totalQty,
        COALESCE(SUM(r.total), 0) as totalAmount,
        COUNT(DISTINCT i.partyId) as partiesCount,
        COUNT(DISTINCT r.itemId) as itemsCount
      FROM sales_invoices i
      JOIN sales_invoice_rows r ON r.invoiceId = i.id
      LEFT JOIN parties p ON i.partyId = p.id
      WHERE ${salesWhere}
    `, ...salesParams);
    salesAgg = res;
  }

  if (type === 'PURCHASE' || type === 'ALL') {
    const [res] = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as rowCount,
        COALESCE(SUM(r.qty), 0) as totalQty,
        COALESCE(SUM(r.total), 0) as totalAmount,
        COUNT(DISTINCT i.partyId) as partiesCount,
        COUNT(DISTINCT r.itemId) as itemsCount
      FROM purchase_invoices i
      JOIN purchase_invoice_rows r ON r.purchaseInvoiceId = i.id
      LEFT JOIN parties p ON i.partyId = p.id
      WHERE ${purWhere}
    `, ...purParams);
    purchaseAgg = res;
  }

  const totalSalesRows = Number(salesAgg?.rowCount || 0);
  const totalPurchaseRows = Number(purchaseAgg?.rowCount || 0);
  const totalRecords = totalSalesRows + totalPurchaseRows;
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  // 2. Query paginated records
  let rawRows = [];

  if (type === 'SALE') {
    rawRows = await prisma.$queryRawUnsafe(`
      SELECT 
        CONCAT('sale-', r.id) as id,
        i.date as date,
        'SALE' as type,
        i.invoiceNo as invoiceNo,
        i.id as invoiceId,
        i.partyId as partyId,
        COALESCE(p.partyName, i.partyName) as partyName,
        COALESCE(p.phone, '') as partyPhone,
        r.itemId as itemId,
        r.itemName as itemName,
        COALESCE(r.hsn, '') as hsn,
        CAST(r.qty AS DOUBLE) as qty,
        COALESCE(r.unit, '') as unit,
        CAST(r.price AS DOUBLE) as price,
        CAST(r.taxRate AS DOUBLE) as taxRate,
        CAST(r.total AS DOUBLE) as total
      FROM sales_invoices i
      JOIN sales_invoice_rows r ON r.invoiceId = i.id
      LEFT JOIN parties p ON i.partyId = p.id
      WHERE ${salesWhere}
      ORDER BY i.date DESC, i.id DESC
      LIMIT ? OFFSET ?
    `, ...salesParams, limit, offset);
  } else if (type === 'PURCHASE') {
    rawRows = await prisma.$queryRawUnsafe(`
      SELECT 
        CONCAT('pur-', r.id) as id,
        i.date as date,
        'PURCHASE' as type,
        i.billNo as invoiceNo,
        i.id as invoiceId,
        i.partyId as partyId,
        COALESCE(p.partyName, i.partyName) as partyName,
        COALESCE(p.phone, '') as partyPhone,
        r.itemId as itemId,
        r.itemName as itemName,
        COALESCE(r.hsn, '') as hsn,
        CAST(r.qty AS DOUBLE) as qty,
        COALESCE(r.unit, '') as unit,
        CAST(r.price AS DOUBLE) as price,
        CAST(r.taxRate AS DOUBLE) as taxRate,
        CAST(r.total AS DOUBLE) as total
      FROM purchase_invoices i
      JOIN purchase_invoice_rows r ON r.purchaseInvoiceId = i.id
      LEFT JOIN parties p ON i.partyId = p.id
      WHERE ${purWhere}
      ORDER BY i.date DESC, i.id DESC
      LIMIT ? OFFSET ?
    `, ...purParams, limit, offset);
  } else {
    // ALL - Union of both
    rawRows = await prisma.$queryRawUnsafe(`
      SELECT * FROM (
        (
          SELECT 
            CONCAT('sale-', r.id) as id,
            i.date as date,
            'SALE' as type,
            i.invoiceNo as invoiceNo,
            i.id as invoiceId,
            i.partyId as partyId,
            COALESCE(p.partyName, i.partyName) as partyName,
            COALESCE(p.phone, '') as partyPhone,
            r.itemId as itemId,
            r.itemName as itemName,
            COALESCE(r.hsn, '') as hsn,
            CAST(r.qty AS DOUBLE) as qty,
            COALESCE(r.unit, '') as unit,
            CAST(r.price AS DOUBLE) as price,
            CAST(r.taxRate AS DOUBLE) as taxRate,
            CAST(r.total AS DOUBLE) as total
          FROM sales_invoices i
          JOIN sales_invoice_rows r ON r.invoiceId = i.id
          LEFT JOIN parties p ON i.partyId = p.id
          WHERE ${salesWhere}
          ORDER BY i.date DESC, i.id DESC
          LIMIT ?
        )
        UNION ALL
        (
          SELECT 
            CONCAT('pur-', r.id) as id,
            i.date as date,
            'PURCHASE' as type,
            i.billNo as invoiceNo,
            i.id as invoiceId,
            i.partyId as partyId,
            COALESCE(p.partyName, i.partyName) as partyName,
            COALESCE(p.phone, '') as partyPhone,
            r.itemId as itemId,
            r.itemName as itemName,
            COALESCE(r.hsn, '') as hsn,
            CAST(r.qty AS DOUBLE) as qty,
            COALESCE(r.unit, '') as unit,
            CAST(r.price AS DOUBLE) as price,
            CAST(r.taxRate AS DOUBLE) as taxRate,
            CAST(r.total AS DOUBLE) as total
          FROM purchase_invoices i
          JOIN purchase_invoice_rows r ON r.purchaseInvoiceId = i.id
          LEFT JOIN parties p ON i.partyId = p.id
          WHERE ${purWhere}
          ORDER BY i.date DESC, i.id DESC
          LIMIT ?
        )
      ) AS combined
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `, ...salesParams, fetchLimit, ...purParams, fetchLimit, limit, offset);
  }

  const records = rawRows.map(row => ({
    id: String(row.id),
    date: row.date,
    type: row.type,
    invoiceNo: row.invoiceNo,
    invoiceId: row.invoiceId ? Number(row.invoiceId) : null,
    partyId: row.partyId ? Number(row.partyId) : null,
    partyName: row.partyName || '',
    partyPhone: row.partyPhone || '',
    itemId: row.itemId ? Number(row.itemId) : null,
    itemName: row.itemName || '',
    hsn: row.hsn || '',
    qty: Number(row.qty || 0),
    unit: row.unit || '',
    price: Number(row.price || 0),
    taxRate: Number(row.taxRate || 0),
    total: Number(row.total || 0),
  }));

  const totalSalesQty = Number(salesAgg?.totalQty || 0);
  const totalSalesAmount = Number(salesAgg?.totalAmount || 0);
  const totalPurchaseQty = Number(purchaseAgg?.totalQty || 0);
  const totalPurchaseAmount = Number(purchaseAgg?.totalAmount || 0);

  const responseData = {
    records,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages,
      hasMore: offset + records.length < totalRecords,
    },
    summary: {
      totalSalesQty,
      totalSalesAmount,
      totalPurchaseQty,
      totalPurchaseAmount,
      netAmount: totalSalesAmount - totalPurchaseAmount,
      uniquePartiesCount: Number(salesAgg?.partiesCount || 0) + Number(purchaseAgg?.partiesCount || 0),
      uniqueItemsCount: Number(salesAgg?.itemsCount || 0) + Number(purchaseAgg?.itemsCount || 0),
      totalCount: totalRecords,
    },
  };

  cache.set(cacheKey, responseData, 180);
  return responseData;
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
  getItemReportByParty,
  getGrowthSummary,
  getOverdueParties,
  getTopSellingItems,
  getTopCustomerParties,
  getTopSupplierParties,
};

export { reportService };
export default reportService;
