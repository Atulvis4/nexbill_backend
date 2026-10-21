import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

/**
 * Preview recipe ingredients requirements and compare with available stocks.
 */
const previewManufacturing = async (businessId, finishedGoodId, quantity) => {
  const parsedQty = Number(quantity);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid quantity');
  }

  // 1. Verify item exists and belongs to business
  const finishedGood = await prisma.item.findFirst({
    where: { id: finishedGoodId, businessId, isArchived: false },
    include: { unit: true }
  });
  if (!finishedGood) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Finished good not found');
  }

  // 2. Fetch BOM components and include their raw material details (optimized batch query)
  const components = await prisma.bomComponent.findMany({
    where: { finishedGoodId },
    include: {
      rawMaterial: {
        include: { unit: true }
      }
    },
    orderBy: { id: 'asc' }
  });

  if (components.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This product does not have a Bill of Materials (recipe) configured');
  }

  const finishedGoodMultiplier = finishedGood.unit?.multiplier ? Number(finishedGood.unit.multiplier) : 1;
  const baseQtyToProduce = parsedQty * finishedGoodMultiplier;

  let isSufficient = true;
  const ingredients = components.map((comp) => {
    const rawMaterial = comp.rawMaterial;
    const rmMultiplier = rawMaterial.unit?.multiplier ? Number(rawMaterial.unit.multiplier) : 1;

    const requiredBase = Number(comp.quantity) * baseQtyToProduce;
    const availableBase = Number(rawMaterial.stockQuantity);
    const deficitBase = Math.max(0, requiredBase - availableBase);

    if (deficitBase > 0) {
      isSufficient = false;
    }

    return {
      rawMaterialId: rawMaterial.id,
      name: rawMaterial.name,
      required: requiredBase / rmMultiplier,
      available: availableBase / rmMultiplier,
      deficit: deficitBase / rmMultiplier,
      unit: rawMaterial.unit?.name || rawMaterial.unit?.code || '',
    };
  });

  return {
    finishedGood: {
      id: finishedGood.id,
      name: finishedGood.name,
      currentStock: Number(finishedGood.stockQuantity) / finishedGoodMultiplier,
      unit: finishedGood.unit?.name || finishedGood.unit?.code || '',
    },
    quantity: parsedQty,
    ingredients,
    isSufficient,
  };
};

/**
 * Execute direct manufacturing: verify stock, deduct ingredients, increment finished product, create ledger logs.
 */
const executeDirectManufacturing = async (businessId, { finishedGoodId, quantity, notes }) => {
  const parsedQty = Number(quantity);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid quantity');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Verify finished good exists and has a BOM
    const finishedGood = await tx.item.findFirst({
      where: { id: finishedGoodId, businessId, isArchived: false },
      include: { unit: true }
    });
    if (!finishedGood) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Finished good not found');
    }

    const components = await tx.bomComponent.findMany({
      where: { finishedGoodId },
      include: {
        rawMaterial: {
          include: { unit: true }
        }
      }
    });

    if (components.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product has no Bill of Materials configured');
    }

    // 2. Perform sufficiency check (using in-memory comparison to avoid N+1 queries)
    const deficits = [];
    const ingredientUpdates = [];
    const finishedGoodMultiplier = finishedGood.unit?.multiplier ? Number(finishedGood.unit.multiplier) : 1;
    const baseQtyToProduce = parsedQty * finishedGoodMultiplier;

    for (const comp of components) {
      const rawMaterial = comp.rawMaterial;
      const required = Number(comp.quantity) * baseQtyToProduce;
      const available = Number(rawMaterial.stockQuantity);
      
      if (available < required) {
        deficits.push({
          name: rawMaterial.name,
          required,
          available,
          deficit: required - available
        });
      }

      ingredientUpdates.push({
        rawMaterialId: rawMaterial.id,
        required,
        name: rawMaterial.name,
        purchasePrice: Number(rawMaterial.purchasePrice || 0),
        stockValue: Number(rawMaterial.stockValue || 0),
      });
    }

    // 3. Create completed Manufacturing Order record
    const count = await tx.manufacturingOrder.count({ where: { businessId } });
    const orderNo = `MO-${String(count + 1).padStart(5, '0')}`;

    const order = await tx.manufacturingOrder.create({
      data: {
        businessId,
        orderNo,
        finishedGoodId,
        quantity: parsedQty,
        status: 'COMPLETED',
        notes: notes || null,
        completedAt: new Date(),
      }
    });

    // 4. Deduct raw materials and write OUT ledger entries
    let totalCostOfIngredients = 0;
    for (const update of ingredientUpdates) {
      const rawMaterialCost = update.required * update.purchasePrice;
      totalCostOfIngredients += rawMaterialCost;

      const newRawVal = update.stockValue - rawMaterialCost;

      await tx.item.update({
        where: { id: update.rawMaterialId },
        data: {
          stockQuantity: { decrement: update.required },
          stockValue: newRawVal,
        }
      });

      await tx.stockLedger.create({
        data: {
          businessId,
          itemId: update.rawMaterialId,
          type: 'OUT',
          quantity: update.required,
          adjustedValue: rawMaterialCost,
          referenceType: 'MANUFACTURING_ORDER',
          referenceId: order.id,
          description: `Consumed to manufacture product (MO #${orderNo})`,
        }
      });
    }

    // 5. Increment finished good and write IN ledger entry (using base quantity)
    const currentFinishedVal = Number(finishedGood.stockValue || 0);
    const newFinishedVal = currentFinishedVal + totalCostOfIngredients;

    const updatedFinishedGood = await tx.item.update({
      where: { id: finishedGoodId },
      data: {
        stockQuantity: { increment: baseQtyToProduce },
        stockValue: newFinishedVal,
      },
      include: { category: true, unit: true }
    });

    await tx.stockLedger.create({
      data: {
        businessId,
        itemId: finishedGoodId,
        type: 'IN',
        quantity: baseQtyToProduce,
        adjustedValue: totalCostOfIngredients,
        referenceType: 'MANUFACTURING_ORDER',
        referenceId: order.id,
        description: `Manufactured product (MO #${orderNo})`,
      }
    });

    return {
      order,
      finishedGood: updatedFinishedGood
    };
  });
};

/**
 * List all manufacturing orders for the business.
 */
const listManufacturingOrders = async (businessId) => {
  return await prisma.manufacturingOrder.findMany({
    where: { businessId },
    include: {
      finishedGood: {
        include: { unit: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

const manufacturingService = {
  previewManufacturing,
  executeDirectManufacturing,
  listManufacturingOrders,
};

export { manufacturingService };
export default manufacturingService;
