import bankingService from '../services/banking.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const listAccounts = asyncHandler(async (req, res) => {
  const accounts = await bankingService.listAccounts(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Bank accounts fetched successfully', accounts);
});

const createAccount = asyncHandler(async (req, res) => {
  const account = await bankingService.createAccount(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Bank account created successfully', account);
});

const listTransactions = asyncHandler(async (req, res) => {
  const transactions = await bankingService.listTransactions(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Banking transactions fetched successfully', transactions);
});

const createTransaction = asyncHandler(async (req, res) => {
  const transaction = await bankingService.createTransaction(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Banking transaction recorded successfully', transaction);
});

const bankingController = {
  listAccounts,
  createAccount,
  listTransactions,
  createTransaction,
};

export { bankingController };
export default bankingController;
