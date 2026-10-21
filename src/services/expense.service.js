import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

const listExpenses = async (businessId) => {
  return await prisma.expense.findMany({
    where: { businessId },
    orderBy: { date: 'desc' },
  });
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
