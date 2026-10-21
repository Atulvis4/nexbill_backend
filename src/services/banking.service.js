import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

const listAccounts = async (businessId) => {
  return await prisma.bankAccount.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
  });
};

const createAccount = async (businessId, data) => {
  return await prisma.bankAccount.create({
    data: {
      ...data,
      businessId,
      currentBalance: data.openingBalance,
    },
  });
};

const listTransactions = async (businessId) => {
  return await prisma.bankingTransaction.findMany({
    where: { businessId },
    include: { bankAccount: true },
    orderBy: { date: 'desc' },
  });
};

const createTransaction = async (businessId, data) => {
  const { bankAccountId, date, type, amount, description } = data;

  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, businessId },
  });
  if (!account) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bank account not found');
  }

  return await prisma.$transaction(async (tx) => {
    // Create transaction
    const transaction = await tx.bankingTransaction.create({
      data: {
        businessId,
        bankAccountId,
        date: new Date(date),
        type,
        amount,
        description,
      },
    });

    // Update balance
    let balanceChange = amount;
    if (type === 'WITHDRAWAL') {
      balanceChange = -amount;
    }

    await tx.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        currentBalance: { increment: balanceChange },
      },
    });

    return transaction;
  });
};

const bankingService = {
  listAccounts,
  createAccount,
  listTransactions,
  createTransaction,
};

export { bankingService };
export default bankingService;
