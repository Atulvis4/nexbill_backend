import { z } from 'zod';

const purchaseRowSchema = z.object({
  itemId: z.number().int().optional().nullable(),
  itemName: z.string().trim().min(1),
  hsn: z.string().trim().optional().nullable(),
  qty: z.coerce.number().positive(),
  unit: z.string().trim().optional().nullable(),
  unitMultiplier: z.coerce.number().default(1),
  price: z.coerce.number().nonnegative(),
  discountValue: z.coerce.number().default(0),
  discountIsPercentage: z.boolean().default(false),
  taxRate: z.coerce.number().default(0),
  taxAmount: z.coerce.number().default(0),
  total: z.coerce.number().nonnegative(),
  box: z.coerce.number().int().optional().nullable(),
});

const createPurchaseSchema = z.object({
  body: z.object({
    billNo: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
    partyId: z.number().int().optional().nullable(),
    partyName: z.string().trim().min(1),
    phone: z.string().trim().optional().nullable(),
    stateOfSupply: z.string().trim().optional().nullable(),
    paymentType: z.enum(['CASH', 'CREDIT', 'BANK']).default('CREDIT'),
    subtotal: z.coerce.number().nonnegative(),
    cgst: z.coerce.number().default(0),
    sgst: z.coerce.number().default(0),
    igst: z.coerce.number().default(0),
    totalTax: z.coerce.number().default(0),
    grandTotal: z.coerce.number().nonnegative(),
    paid: z.coerce.number().default(0),
    balance: z.coerce.number().default(0),
    termsText: z.string().trim().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    rows: z.array(purchaseRowSchema).min(1),
    bankAccountId: z.number().int().optional().nullable(),
  }),
});

const createPaymentOutSchema = z.object({
  body: z.object({
    partyId: z.number().int().optional().nullable(),
    bankAccountId: z.number().int().optional().nullable(),
    paymentNo: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
    amount: z.coerce.number().positive(),
    paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CHEQUE', 'CARD', 'OTHER']),
    referenceNo: z.string().trim().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    salesReturnId: z.number().int().optional().nullable(),
  }),
});

const createPurchaseReturnSchema = z.object({
  body: z.object({
    partyId: z.number().int().optional().nullable(),
    originalBillId: z.number().int().optional().nullable(),
    returnNo: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
    returnType: z.enum(['DEBIT_NOTE', 'REPLACEMENT']),
    grandTotal: z.coerce.number().nonnegative(),
    notes: z.string().trim().optional().nullable(),
    rows: z.array(purchaseRowSchema).min(1),
    isCashRefund: z.boolean().optional().nullable(),
  }),
});

export { createPurchaseSchema, createPaymentOutSchema, createPurchaseReturnSchema };
