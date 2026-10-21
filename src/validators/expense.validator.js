import { z } from 'zod';

const createExpenseSchema = z.object({
  body: z.object({
    expenseCategoryName: z.string().trim().min(2).max(100),
    amount: z.coerce.number().positive(),
    note: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
  }),
});

const updateExpenseSchema = z.object({
  body: z.object({
    expenseCategoryName: z.string().trim().min(2).max(100).optional(),
    amount: z.coerce.number().positive().optional(),
    note: z.string().trim().optional().nullable(),
    date: z.string().datetime().optional(),
  }),
});

export { createExpenseSchema, updateExpenseSchema };
