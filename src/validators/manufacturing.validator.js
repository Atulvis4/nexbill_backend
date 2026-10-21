import { z } from 'zod';

const executeDirectSchema = z.object({
  body: z.object({
    finishedGoodId: z.number().int().positive('Invalid finished good ID'),
    quantity: z.coerce.number().positive('Quantity must be greater than 0'),
    notes: z.string().trim().max(1000).optional().nullable(),
  }),
});

const previewSchema = z.object({
  query: z.object({
    finishedGoodId: z.coerce.number().int().positive('Invalid finished good ID'),
    quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  }),
});

export {
  executeDirectSchema,
  previewSchema,
};
