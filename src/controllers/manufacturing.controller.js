import manufacturingService from '../services/manufacturing.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const previewManufacturing = asyncHandler(async (req, res) => {
  const { finishedGoodId, quantity } = req.query;
  const preview = await manufacturingService.previewManufacturing(
    req.businessId,
    parseInt(finishedGoodId, 10),
    parseFloat(quantity)
  );
  sendSuccess(res, httpStatus.OK, 'Manufacturing preview generated successfully', preview);
});

const executeDirect = asyncHandler(async (req, res) => {
  const { finishedGoodId, quantity, notes } = req.body;
  const result = await manufacturingService.executeDirectManufacturing(req.businessId, {
    finishedGoodId: parseInt(finishedGoodId, 10),
    quantity: parseFloat(quantity),
    notes,
  });
  sendSuccess(res, httpStatus.CREATED, 'Manufacturing run executed successfully', result);
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await manufacturingService.listManufacturingOrders(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Manufacturing runs retrieved successfully', orders);
});

const manufacturingController = {
  previewManufacturing,
  executeDirect,
  listOrders,
};

export { manufacturingController };
export default manufacturingController;
