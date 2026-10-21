import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

// =========================================================================
// CATEGORY SERVICES
// =========================================================================

const listCategories = async (businessId) => {
  return await prisma.category.findMany({
    where: { businessId },
    include: { parentCategory: true },
    orderBy: { name: 'asc' },
  });
};

const createCategory = async (businessId, data) => {
  const existing = await prisma.category.findFirst({
    where: { businessId, name: data.name },
  });
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, 'Category name already exists in this business');
  }

  return await prisma.category.create({
    data: {
      ...data,
      businessId,
    },
  });
};

const updateCategory = async (businessId, id, data) => {
  const category = await prisma.category.findFirst({
    where: { id, businessId },
  });
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  if (data.name) {
    const existing = await prisma.category.findFirst({
      where: { businessId, name: data.name, id: { not: id } },
    });
    if (existing) {
      throw new ApiError(httpStatus.CONFLICT, 'Category name already exists');
    }
  }

  return await prisma.category.update({
    where: { id },
    data,
  });
};

const deleteCategory = async (businessId, id) => {
  const category = await prisma.category.findFirst({
    where: { id, businessId },
  });
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  await prisma.category.delete({
    where: { id },
  });

  return { success: true };
};

// =========================================================================
// UNIT SERVICES
// =========================================================================

const listUnits = async (businessId) => {
  return await prisma.unit.findMany({
    where: { businessId },
    include: { secondaryUnit: true },
    orderBy: { name: 'asc' },
  });
};

const createUnit = async (businessId, data) => {
  return await prisma.unit.create({
    data: {
      ...data,
      businessId,
    },
    include: {
      secondaryUnit: true,
    },
  });
};

const updateUnit = async (businessId, id, data) => {
  const unit = await prisma.unit.findFirst({
    where: { id, businessId },
  });
  if (!unit) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Unit not found');
  }

  return await prisma.unit.update({
    where: { id },
    data,
    include: {
      secondaryUnit: true,
    },
  });
};

const deleteUnit = async (businessId, id) => {
  const unit = await prisma.unit.findFirst({
    where: { id, businessId },
  });
  if (!unit) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Unit not found');
  }

  await prisma.unit.delete({
    where: { id },
  });

  return { success: true };
};

// =========================================================================
// ITEM SERVICES
// =========================================================================

const listItems = async (businessId, search, type) => {
  const where = {
    businessId,
    isArchived: false,
  };

  if (type) {
    where.type = type;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { itemCode: { contains: search } },
    ];
  }

  return await prisma.item.findMany({
    where,
    include: { category: true, unit: true },
    orderBy: { name: 'asc' },
  });
};

const createItem = async (businessId, data) => {
  const { asOfDate, bom, ...rest } = data;
  const parsedDate = asOfDate ? new Date(asOfDate) : null;

  return await prisma.$transaction(async (tx) => {
    const hasBom = bom && Array.isArray(bom) && bom.length > 0;
    const stockQtyNum = Number(rest.stockQuantity) || 0;

    let computedStockValue = Number(rest.stockValue) || 0;

    if (hasBom && stockQtyNum > 0) {
      // 1. Verify stock of all raw materials is sufficient
      const rawMaterialIds = bom.map((comp) => comp.rawMaterialId);
      const rawItems = await tx.item.findMany({
        where: { id: { in: rawMaterialIds }, businessId, isArchived: false }
      });

      const rawItemsMap = new Map(rawItems.map((item) => [item.id, item]));
      const deficits = [];
      let totalRawCost = 0;

      for (const comp of bom) {
        const rawItem = rawItemsMap.get(comp.rawMaterialId);
        if (!rawItem) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Raw material with ID ${comp.rawMaterialId} not found in this business`);
        }
        const required = Number(comp.quantity) * stockQtyNum;
        const available = Number(rawItem.stockQuantity);
        if (available < required) {
          deficits.push({
            name: rawItem.name,
            required,
            available,
            deficit: required - available
          });
        }
        totalRawCost += required * Number(rawItem.purchasePrice || 0);
      }

      // 2. Deduct raw material stock and write stock ledger entries
      for (const comp of bom) {
        const rawItem = rawItemsMap.get(comp.rawMaterialId);
        const required = Number(comp.quantity) * stockQtyNum;
        const cost = required * Number(rawItem.purchasePrice || 0);
        const currentRawVal = Number(rawItem.stockValue || 0);
        const newRawVal = currentRawVal - cost;

        await tx.item.update({
          where: { id: comp.rawMaterialId },
          data: {
            stockQuantity: { decrement: required },
            stockValue: newRawVal,
          }
        });

        await tx.stockLedger.create({
          data: {
            businessId,
            itemId: comp.rawMaterialId,
            type: 'OUT',
            quantity: required,
            adjustedValue: cost,
            description: `Consumed to manufacture opening stock of ${rest.name}`,
          }
        });
      }

      computedStockValue = totalRawCost;
    }

    // 3. Create the item
    const item = await tx.item.create({
      data: {
        ...rest,
        itemSubType: hasBom ? 'MANUFACTURED' : (rest.itemSubType || null),
        asOfDate: parsedDate,
        businessId,
        stockValue: computedStockValue,
      },
    });

    // 4. Create BOM components if provided
    if (hasBom) {
      await tx.bomComponent.createMany({
        data: bom.map((comp) => ({
          finishedGoodId: item.id,
          rawMaterialId: comp.rawMaterialId,
          quantity: comp.quantity,
        }))
      });
    }

    // Create opening stock ledger entry if stock quantity > 0
    if (stockQtyNum > 0) {
      await tx.stockLedger.create({
        data: {
          businessId,
          itemId: item.id,
          type: 'IN',
          quantity: item.stockQuantity,
          adjustedValue: computedStockValue,
          description: hasBom ? 'Opening Stock (Manufactured)' : 'Opening Stock',
        },
      });
    }

    return item;
  });
};

const getItem = async (businessId, id) => {
  const item = await prisma.item.findFirst({
    where: { id, businessId, isArchived: false },
    include: { category: true, unit: true },
  });

  if (!item) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Item not found');
  }

  return item;
};

const updateItem = async (businessId, id, data) => {
  await getItem(businessId, id);

  const { asOfDate, ...rest } = data;
  const parsedDate = asOfDate ? new Date(asOfDate) : undefined;

  return await prisma.item.update({
    where: { id },
    data: {
      ...rest,
      ...(parsedDate !== undefined && { asOfDate: parsedDate }),
    },
  });
};

const deleteItem = async (businessId, id) => {
  await getItem(businessId, id);

  await prisma.item.update({
    where: { id },
    data: { isArchived: true },
  });

  return { success: true };
};

const adjustStock = async (businessId, itemId, data) => {
  const item = await getItem(businessId, itemId);
  const qty = Number(data.quantity);
  const currentQty = Number(item.stockQuantity);
  const currentVal = Number(item.stockValue || 0);
  const purchasePrice = Number(item.purchasePrice || 0);

  let newQty = currentQty;
  if (data.type === 'IN') {
    newQty = currentQty + qty;
  } else if (data.type === 'OUT') {
    newQty = currentQty - qty;
  } else if (data.type === 'ADJUSTMENT') {
    newQty = qty; // Directly sets the value
  }

  // Determine adjustment value (falling back to qty * purchasePrice if not provided)
  const isValued = data.adjustedValue !== undefined && data.adjustedValue !== null;
  const adjustmentVal = isValued ? Number(data.adjustedValue) : (qty * purchasePrice);

  // Compute new cumulative stock value
  let newVal = currentVal;
  if (data.type === 'IN') {
    newVal = currentVal + adjustmentVal;
  } else if (data.type === 'OUT') {
    newVal = currentVal - adjustmentVal;
  } else if (data.type === 'ADJUSTMENT') {
    newVal = adjustmentVal;
  }

  return await prisma.$transaction(async (tx) => {
    // Update item stock & cumulative value
    const updatedItem = await tx.item.update({
      where: { id: itemId },
      data: {
        stockQuantity: newQty,
        stockValue: newVal,
      },
    });

    // Create ledger entry with calculated or input adjustment value
    await tx.stockLedger.create({
      data: {
        businessId,
        itemId,
        type: data.type,
        quantity: qty,
        adjustedValue: adjustmentVal,
        description: data.description || 'Manual Stock Adjustment',
      },
    });

    return updatedItem;
  });
};

const getStockLedger = async (businessId, itemId, { cursor, take = 30, search } = {}) => {
  await getItem(businessId, itemId);

  const pageSize = Math.min(Math.max(parseInt(take, 10) || 30, 1), 100);
  const searchTerm = search && search.trim() ? search.trim() : null;

  console.log(`[getStockLedger] businessId=${businessId} itemId=${itemId} cursor=${cursor} take=${pageSize} search=${searchTerm}`);

  const where = { businessId, itemId };
  if (searchTerm) {
    where.description = { contains: searchTerm };
  }

  const rows = await prisma.stockLedger.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
    ...(cursor ? { cursor: { id: parseInt(cursor, 10) }, skip: 1 } : {}),
  });

  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  console.log(`[getStockLedger] -> returning ${items.length} items, hasMore=${hasMore}, nextCursor=${nextCursor}`);

  return { items, nextCursor, hasMore };
};


const getItemTransactions = async (businessId, itemId) => {
  await getItem(businessId, itemId);

  const salesRows = await prisma.salesInvoiceRow.findMany({
    where: {
      itemId,
      invoice: { businessId, isArchived: false },
    },
    include: { invoice: true },
  });

  const purchaseRows = await prisma.purchaseInvoiceRow.findMany({
    where: {
      itemId,
      purchaseInvoice: { businessId, isArchived: false },
    },
    include: { purchaseInvoice: true },
  });

  const transactions = [
    ...salesRows.map((sr) => ({
      id: sr.invoice.id,
      date: sr.invoice.date,
      type: 'Sale',
      referenceNo: sr.invoice.invoiceNo,
      partyName: sr.invoice.partyName,
      qty: Number(sr.qty),
      price: Number(sr.price),
      total: Number(sr.total),
    })),
    ...purchaseRows.map((pr) => ({
      id: pr.purchaseInvoice.id,
      date: pr.purchaseInvoice.date,
      type: 'Purchase',
      referenceNo: pr.purchaseInvoice.billNo,
      partyName: pr.purchaseInvoice.partyName,
      qty: Number(pr.qty),
      price: Number(pr.price),
      total: Number(pr.total),
    })),
  ];

  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  return transactions;
};

// =========================================================================
// BOM SERVICES
// =========================================================================

const getBom = async (businessId, itemId) => {
  // Verify item belongs to business and is a manufactured good
  const item = await prisma.item.findFirst({
    where: { id: itemId, businessId, isArchived: false },
  });
  if (!item) throw new ApiError(httpStatus.NOT_FOUND, 'Item not found');

  const components = await prisma.bomComponent.findMany({
    where: { finishedGoodId: itemId },
    include: {
      rawMaterial: { include: { unit: true } },
    },
    orderBy: { id: 'asc' },
  });

  return { finishedGood: item, components };
};

const upsertBom = async (businessId, itemId, components) => {
  // Verify finished good belongs to business
  const finishedGood = await prisma.item.findFirst({
    where: { id: itemId, businessId, isArchived: false },
  });
  if (!finishedGood) throw new ApiError(httpStatus.NOT_FOUND, 'Item not found');

  // Verify all raw materials belong to the same business
  for (const comp of components) {
    const raw = await prisma.item.findFirst({
      where: { id: comp.rawMaterialId, businessId, isArchived: false },
    });
    if (!raw) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Raw material ID ${comp.rawMaterialId} not found in this business`);
    }
    if (comp.rawMaterialId === itemId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'A finished good cannot be its own raw material');
    }
  }

  return await prisma.$transaction(async (tx) => {
    // Delete all existing BOM entries for this finished good
    await tx.bomComponent.deleteMany({ where: { finishedGoodId: itemId } });

    // Re-create from the new list
    await tx.bomComponent.createMany({
      data: components.map((c) => ({
        finishedGoodId: itemId,
        rawMaterialId: c.rawMaterialId,
        quantity: c.quantity,
      })),
    });

    return await tx.bomComponent.findMany({
      where: { finishedGoodId: itemId },
      include: { rawMaterial: { include: { unit: true } } },
    });
  });
};

const inventoryService = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  listItems,
  createItem,
  getItem,
  updateItem,
  deleteItem,
  adjustStock,
  getStockLedger,
  getItemTransactions,
  getBom,
  upsertBom,
};

export { inventoryService };
export default inventoryService;
