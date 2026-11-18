import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

const listExpenses = async (businessId, options = {}) => {
  const query = typeof options === 'string' ? { search: options } : (options || {});
  const { search, category, fromDate, toDate } = query;

  const where = { businessId };
  if (category) {
    where.expenseCategoryName = category;
  }
  if (search) {
    where.OR = [
      { expenseCategoryName: { contains: search } },
      { note: { contains: search } },
    ];
  }
  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(fromDate);
    if (toDate) where.date.lte = new Date(toDate);
  }

  const paginationParams = getPaginationParams(query, { limit: 50 });
  const total = await prisma.expense.count({ where });
  const orderBy = [{ date: 'desc' }, { createdAt: 'desc' }];

  if (paginationParams.isAll) {
    const data = await prisma.expense.findMany({
      where,
      orderBy,
    });
    return formatPaginatedResponse(data, total, paginationParams);
  }

  const data = await prisma.expense.findMany({
    where,
    orderBy,
    skip: paginationParams.skip,
    take: paginationParams.take,
  });

  return formatPaginatedResponse(data, total, paginationParams);
};

const createExpense = async (businessId, data) => {
  return await prisma.expense.create({
    data: {
      ...data,
      businessId,
      date: new Date(data.date),
      amount: data.amount,
    },
  });
};

const getExpense = async (businessId, id) => {
  const expense = await prisma.expense.findFirst({
    where: { id, businessId },
  });
  if (!expense) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Expense record not found');
  }
  return expense;
};

const updateExpense = async (businessId, id, data) => {
  await getExpense(businessId, id);

  const { date, ...rest } = data;
  const parsedDate = date ? new Date(date) : undefined;

  return await prisma.expense.update({
    where: { id },
    data: {
      ...rest,
      ...(parsedDate && { date: parsedDate }),
    },
  });
};

const deleteExpense = async (businessId, id) => {
  await getExpense(businessId, id);

  await prisma.expense.delete({
    where: { id },
  });

  return { success: true };
};

const expenseService = {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};

export { expenseService };
export default expenseService;
