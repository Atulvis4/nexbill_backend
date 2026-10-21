import { z } from 'zod';

export const createDiscountSchema = z.object({
  name: z.string().min(1, 'Discount name is required').max(100),
  type: z.enum(['PERCENTAGE', 'FIXED'], {
    errorMap: () => ({ message: 'Type must be PERCENTAGE or FIXED' }),
  }),
  value: z.coerce.number().positive('Discount value must be positive'),
});

export const updateDiscountSchema = createDiscountSchema.partial();
