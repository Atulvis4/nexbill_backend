import { z } from 'zod';

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    gstin: z.string().trim().max(20).optional().nullable(),
    phone: z.string().trim().max(20).optional().nullable(),
    email: z.string().trim().email().optional().nullable().or(z.literal('')),
    billingAddress: z.string().trim().optional().nullable(),
    state: z.string().trim().max(50).optional().nullable(),
    businessType: z.string().trim().max(50).optional().nullable(),
  }),
});

const updateSettingsSchema = z.object({
  body: z.object({
    gstEnabled: z.boolean().optional(),
    compositionScheme: z.boolean().optional(),
    defaultTaxRate: z.coerce.number().optional().nullable(),
    rcmEnabled: z.boolean().optional(),
    showHsnColumn: z.boolean().optional(),
    calculateTaxBeforeDiscount: z.boolean().optional(),
    printTemplateStyle: z.string().trim().optional().nullable(),
    printPageSize: z.string().trim().optional().nullable(),
    printShowLogo: z.boolean().optional(),
    printBankDetails: z.string().trim().optional().nullable(),
    printTermsFooter: z.string().trim().optional().nullable(),
  }),
});

const updateNumberingSchema = z.object({
  body: z.object({
    numberingSalesPrefix: z.string().trim().optional().nullable(),
    numberingSalesNext: z.coerce.number().int().positive().optional(),
    numberingPurchasePrefix: z.string().trim().optional().nullable(),
    numberingPurchaseNext: z.coerce.number().int().positive().optional(),
    numberingEstimatePrefix: z.string().trim().optional().nullable(),
    numberingEstimateNext: z.coerce.number().int().positive().optional(),
    numberingChallanPrefix: z.string().trim().optional().nullable(),
    numberingChallanNext: z.coerce.number().int().positive().optional(),
    numberingOrderPrefix: z.string().trim().optional().nullable(),
    numberingOrderNext: z.coerce.number().int().positive().optional(),
    numberingReturnPrefix: z.string().trim().optional().nullable(),
    numberingReturnNext: z.coerce.number().int().positive().optional(),
    numberingReceiptPrefix: z.string().trim().optional().nullable(),
    numberingReceiptNext: z.coerce.number().int().positive().optional(),
  }),
});

export { updateProfileSchema, updateSettingsSchema, updateNumberingSchema };
