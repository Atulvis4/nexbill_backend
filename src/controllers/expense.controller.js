import expenseService from '../services/expense.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const listExpenses = asyncHandler(async (req, res) => {
  const expenses = await expenseService.listExpenses(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Expenses list fetched successfully', expenses);
});

const createExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Expense recorded successfully', expense);
});

const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await expenseService.updateExpense(req.businessId, parseInt(id, 10), req.body);
  sendSuccess(res, httpStatus.OK, 'Expense updated successfully', updated);
});

const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await expenseService.deleteExpense(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Expense deleted successfully', result);
});

const expenseController = {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};

export { expenseController };
export default expenseController;
