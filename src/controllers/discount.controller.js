import discountService from '../services/discount.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const listDiscounts = asyncHandler(async (req, res) => {
  const discounts = await discountService.listDiscounts(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Discounts listed successfully', discounts);
});

const createDiscount = asyncHandler(async (req, res) => {
  const discount = await discountService.createDiscount(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Discount created successfully', discount);
});

const getDiscount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const discount = await discountService.getDiscount(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Discount fetched successfully', discount);
});

const updateDiscount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await discountService.updateDiscount(req.businessId, parseInt(id, 10), req.body);
  sendSuccess(res, httpStatus.OK, 'Discount updated successfully', updated);
});

const deleteDiscount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await discountService.deleteDiscount(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Discount deleted successfully', result);
});

const discountController = {
  listDiscounts,
  createDiscount,
  getDiscount,
  updateDiscount,
  deleteDiscount,
};

export { discountController };
export default discountController;
