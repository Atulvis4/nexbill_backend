import { z } from 'zod';

const createPartySchema = z.object({
  body: z.object({
    partyName: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(20).optional().nullable(),
    email: z.string().trim().email().optional().nullable().or(z.literal('')),
    billingAddress: z.string().trim().optional().nullable(),
    gstType: z.enum(['UNREGISTERED', 'REGULAR', 'COMPOSITION', 'CONSUMER']).optional().nullable(),
    gstin: z.string().trim().max(20).optional().nullable(),
    openingBalance: z.coerce.number().default(0),
    balanceType: z.enum(['RECEIVABLE', 'PAYABLE']).optional().nullable(),
    state: z.string().trim().max(50).optional().nullable(),
  }),
});

const updatePartySchema = z.object({
  body: z.object({
    partyName: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().max(20).optional().nullable(),
    email: z.string().trim().email().optional().nullable().or(z.literal('')),
    billingAddress: z.string().trim().optional().nullable(),
    gstType: z.enum(['UNREGISTERED', 'REGULAR', 'COMPOSITION', 'CONSUMER']).optional().nullable(),
    gstin: z.string().trim().max(20).optional().nullable(),
    openingBalance: z.coerce.number().optional(),
    balanceType: z.enum(['RECEIVABLE', 'PAYABLE']).optional().nullable(),
    state: z.string().trim().max(50).optional().nullable(),
  }),
});

export { createPartySchema, updatePartySchema };
