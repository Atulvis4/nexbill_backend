import { z } from 'zod';

const invoiceRowSchema = z.object({
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

const createInvoiceSchema = z.object({
  body: z.object({
    invoiceNo: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
    partyId: z.number().int().optional().nullable(),
    partyName: z.string().trim().min(1),
    phone: z.string().trim().optional().nullable(),
    stateOfSupply: z.string().trim().optional().nullable(),
    isCash: z.boolean().default(false),
    subtotal: z.coerce.number().nonnegative(),
    cgst: z.coerce.number().default(0),
    sgst: z.coerce.number().default(0),
    igst: z.coerce.number().default(0),
    totalTax: z.coerce.number().default(0),
    grandTotal: z.coerce.number().nonnegative(),
    paid: z.coerce.number().default(0),
    balance: z.coerce.number().default(0),
    roundOff: z.coerce.number().default(0),
    previousBalance: z.coerce.number().optional().nullable(),
    previousBalancePaid: z.coerce.number().optional().nullable(),
    termsText: z.string().trim().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    rows: z.array(invoiceRowSchema).min(1),
    bankAccountId: z.number().int().optional().nullable(),
  }),
});

const createEstimateSchema = z.object({
  body: z.object({
    estimateNo: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
    partyId: z.number().int().optional().nullable(),
    partyName: z.string().trim().min(1),
    phone: z.string().trim().optional().nullable(),
    stateOfSupply: z.string().trim().optional().nullable(),
    subtotal: z.coerce.number().nonnegative(),
    totalTax: z.coerce.number().default(0),
    grandTotal: z.coerce.number().nonnegative(),
    termsText: z.string().trim().optional().nullable(),
    rows: z.array(invoiceRowSchema).min(1),
  }),
});

const createPaymentInSchema = z.object({
  body: z.object({
    partyId: z.number().int().optional().nullable(),
    bankAccountId: z.number().int().optional().nullable(),
    receiptNo: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
    receivedAmount: z.coerce.number().positive(),
    paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CHEQUE', 'CARD', 'OTHER']),
    referenceNo: z.string().trim().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    allocations: z.array(
      z.object({
        invoiceId: z.number().int(),
        amount: z.coerce.number().nonnegative(),
      })
    ).optional(),
  }),
});

const returnRowSchema = z.object({
  itemId: z.number().int().optional().nullable(),
  itemName: z.string().trim().min(1),
  hsn: z.string().trim().optional().nullable(),
  qty: z.coerce.number().positive(),
  unit: z.string().trim().optional().nullable(),
  price: z.coerce.number().nonnegative(),
  discountValue: z.coerce.number().default(0),
  discountIsPercentage: z.boolean().default(false),
  taxRate: z.coerce.number().default(0),
  taxAmount: z.coerce.number().default(0),
  total: z.coerce.number().nonnegative(),
  box: z.coerce.number().int().optional().nullable(),
});

const createReturnSchema = z.object({
  body: z.object({
    partyId: z.number().int().optional().nullable(),
    originalInvoiceId: z.number().int().optional().nullable(),
    returnNo: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
    returnType: z.enum(['CREDIT_NOTE', 'REPLACEMENT']),
    grandTotal: z.coerce.number().nonnegative(),
    notes: z.string().trim().optional().nullable(),
    rows: z.array(returnRowSchema).min(1),
    isCashRefund: z.boolean().optional().nullable(),
  }),
});

const createChallanSchema = z.object({
  body: z.object({
    partyId: z.number().int().optional().nullable(),
    challanNo: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
    stateOfSupply: z.string().trim().optional().nullable(),
    transportDetails: z.string().trim().optional().nullable(),
    ewayBillNo: z.string().trim().optional().nullable(),
    deliveryAddress: z.string().trim().optional().nullable(),
    grandTotal: z.coerce.number().nonnegative(),
    notes: z.string().trim().optional().nullable(),
    termsText: z.string().trim().optional().nullable(),
    rows: z.array(invoiceRowSchema).min(1),
  }),
});

const createOrderSchema = z.object({
  body: z.object({
    partyId: z.number().int().optional().nullable(),
    orderNo: z.string().trim().optional().nullable(),
    date: z.string().datetime(),
    expectedDeliveryDate: z.string().datetime().optional().nullable().or(z.literal('')),
    stateOfSupply: z.string().trim().optional().nullable(),
    deliveryTerms: z.string().trim().optional().nullable(),
    advanceAmount: z.coerce.number().default(0),
    advancePaymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CHEQUE', 'CARD', 'OTHER']).optional().nullable(),
    grandTotal: z.coerce.number().nonnegative(),
    rows: z.array(invoiceRowSchema).min(1),
    bankAccountId: z.number().int().optional().nullable(),
  }),
});

export {
  createInvoiceSchema,
  createEstimateSchema,
  createPaymentInSchema,
  createReturnSchema,
  createChallanSchema,
  createOrderSchema,
};
