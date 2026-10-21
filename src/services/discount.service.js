import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

const listDiscounts = async (businessId) => {
  return await prisma.discount.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
  });
};

const createDiscount = async (businessId, data) => {
  // Prevent duplicate names within same business
  const existing = await prisma.discount.findFirst({
    where: { businessId, name: data.name },
  });
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, 'A discount with this name already exists');
  }

  return await prisma.discount.create({
    data: { ...data, businessId },
  });
};

const getDiscount = async (businessId, id) => {
  const discount = await prisma.discount.findFirst({
    where: { id, businessId },
  });
  if (!discount) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Discount not found');
  }
  return discount;
};

const updateDiscount = async (businessId, id, data) => {
  await getDiscount(businessId, id);

  if (data.name) {
    const existing = await prisma.discount.findFirst({
      where: { businessId, name: data.name, id: { not: id } },
    });
    if (existing) {
      throw new ApiError(httpStatus.CONFLICT, 'A discount with this name already exists');
    }
  }

  return await prisma.discount.update({
    where: { id },
    data,
  });
};

const deleteDiscount = async (businessId, id) => {
  await getDiscount(businessId, id);
  await prisma.discount.delete({ where: { id } });
  return { success: true };
};

const discountService = {
  listDiscounts,
  createDiscount,
  getDiscount,
  updateDiscount,
  deleteDiscount,
};

export { discountService };
export default discountService;
