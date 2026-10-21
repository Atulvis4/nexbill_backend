import { z } from 'zod';

const createItemSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    type: z.enum(['PRODUCT', 'SERVICE']),
    itemSubType: z.enum(['RAW_MATERIAL', 'MANUFACTURED', 'CONSUMABLE']).optional().nullable(),
    hsn: z.string().trim().max(20).optional().nullable(),
    itemCode: z.string().trim().max(50).optional().nullable(),
    categoryId: z.number().int().optional().nullable(),
    unitId: z.number().int().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    salePrice: z.coerce.number().default(0),
    salePriceType: z.enum(['INCLUSIVE', 'EXCLUSIVE']).default('EXCLUSIVE'),
    purchasePrice: z.coerce.number().default(0),
    purchasePriceType: z.enum(['INCLUSIVE', 'EXCLUSIVE']).default('EXCLUSIVE'),
    taxRate: z.coerce.number().default(0),
    stockQuantity: z.coerce.number().default(0),
    stockValue: z.coerce.number().default(0),
    minStock: z.coerce.number().default(0),
    asOfDate: z.string().datetime().optional().nullable().or(z.literal('')),
    bom: z.array(
      z.object({
        rawMaterialId: z.number().int().positive(),
        quantity: z.coerce.number().positive(),
      })
    ).optional().nullable(),
  }),
});

const updateItemSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    type: z.enum(['PRODUCT', 'SERVICE']).optional(),
    itemSubType: z.enum(['RAW_MATERIAL', 'MANUFACTURED', 'CONSUMABLE']).optional().nullable(),
    hsn: z.string().trim().max(20).optional().nullable(),
    itemCode: z.string().trim().max(50).optional().nullable(),
    categoryId: z.number().int().optional().nullable(),
    unitId: z.number().int().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    salePrice: z.coerce.number().optional(),
    salePriceType: z.enum(['INCLUSIVE', 'EXCLUSIVE']).optional(),
    purchasePrice: z.coerce.number().optional(),
    purchasePriceType: z.enum(['INCLUSIVE', 'EXCLUSIVE']).optional(),
    taxRate: z.coerce.number().optional(),
    stockQuantity: z.coerce.number().optional(),
    stockValue: z.coerce.number().optional(),
    minStock: z.coerce.number().optional(),
    asOfDate: z.string().datetime().optional().nullable().or(z.literal('')),
    bom: z.array(
      z.object({
        rawMaterialId: z.number().int().positive(),
        quantity: z.coerce.number().positive(),
      })
    ).optional().nullable(),
  }),
});

const adjustStockSchema = z.object({
  body: z.object({
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
    quantity: z.coerce.number().positive(),
    adjustedValue: z.coerce.number().optional().nullable(),
    description: z.string().trim().optional().nullable(),
  }),
});

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    prefix: z.string().trim().max(20).optional().nullable(),
    parentCategoryId: z.number().int().optional().nullable(),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    prefix: z.string().trim().max(20).optional().nullable(),
    parentCategoryId: z.number().int().optional().nullable(),
  }),
});

const createUnitSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(50),
    code: z.string().trim().max(20).optional().nullable(),
    secondaryUnitId: z.number().int().optional().nullable(),
    multiplier: z.coerce.number().optional().nullable(),
  }),
});

const updateUnitSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(50).optional(),
    code: z.string().trim().max(20).optional().nullable(),
    secondaryUnitId: z.number().int().optional().nullable(),
    multiplier: z.coerce.number().optional().nullable(),
  }),
});

const createBomSchema = z.object({
  body: z.object({
    components: z.array(
      z.object({
        rawMaterialId: z.number().int().positive(),
        quantity: z.coerce.number().positive(),
      })
    ).min(1, 'BOM must have at least one raw material component'),
  }),
});

export {
  createItemSchema,
  updateItemSchema,
  adjustStockSchema,
  createCategorySchema,
  updateCategorySchema,
  createUnitSchema,
  updateUnitSchema,
  createBomSchema,
};
