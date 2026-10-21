import { z } from 'zod';

const createAccountSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    accountType: z.enum(['SAVINGS', 'CURRENT', 'OVERDRAFT', 'CASH']),
    accountNumber: z.string().trim().max(50).optional().nullable(),
    ifscCode: z.string().trim().max(20).optional().nullable(),
    bankName: z.string().trim().max(100).optional().nullable(),
    openingBalance: z.coerce.number().default(0),
  }),
});

const createTransactionSchema = z.object({
  body: z.object({
    bankAccountId: z.number().int(),
    date: z.string().datetime(),
    type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']),
    amount: z.coerce.number().positive(),
    description: z.string().trim().optional().nullable(),
  }),
});

export { createAccountSchema, createTransactionSchema };
