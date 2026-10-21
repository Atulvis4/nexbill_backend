import purchaseService from '../services/purchase.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';
import upload from '../utils/upload.js';

const createPurchase = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.createPurchase(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Purchase invoice created successfully', purchase);
});

const listPurchases = asyncHandler(async (req, res) => {
  const purchases = await purchaseService.listPurchases(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Purchase invoices fetched successfully', purchases);
});

const getPurchase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const purchase = await purchaseService.getPurchase(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Purchase invoice fetched successfully', purchase);
});

const deletePurchase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await purchaseService.deletePurchase(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Purchase invoice deleted/reversed successfully', result);
});

const listPaymentsOut = asyncHandler(async (req, res) => {
  const payments = await purchaseService.listPaymentsOut(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Payment Out receipts fetched successfully', payments);
});

const createPaymentOut = asyncHandler(async (req, res) => {
  const payment = await purchaseService.createPaymentOut(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Payment Out receipt created successfully', payment);
});

const updatePurchase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await purchaseService.updatePurchase(req.businessId, parseInt(id, 10), req.body, req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Purchase invoice updated successfully', updated);
});

const updatePaymentOut = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await purchaseService.updatePaymentOut(req.businessId, parseInt(id, 10), req.body, req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Payment Out updated successfully', updated);
});

// PURCHASE RETURNS / DEBIT NOTES
const createPurchaseReturn = asyncHandler(async (req, res) => {
  const preturn = await purchaseService.createPurchaseReturn(req.businessId, req.body, req.user?.id);
  sendSuccess(res, httpStatus.CREATED, 'Purchase return debit note created successfully', preturn);
});

const listPurchaseReturns = asyncHandler(async (req, res) => {
  const { search, fromDate, toDate, partyId } = req.query;
  const returns = await purchaseService.listPurchaseReturns(req.businessId, search, fromDate, toDate, partyId);
  sendSuccess(res, httpStatus.OK, 'Purchase returns debit notes fetched successfully', returns);
});

const getPurchaseReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const preturn = await purchaseService.getPurchaseReturn(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Purchase return fetched successfully', preturn);
});

const updatePurchaseReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const preturn = await purchaseService.updatePurchaseReturn(req.businessId, parseInt(id, 10), req.body, req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Purchase return updated successfully', preturn);
});

const deletePurchaseReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await purchaseService.deletePurchaseReturn(req.businessId, parseInt(id, 10), req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Purchase return deleted successfully', result);
});

// =========================================================================
// FILE ATTACHMENTS (Purchase Invoice)
// =========================================================================

const uploadPurchaseFile = [
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.file) throw { status: 400, message: 'No file uploaded' };
    const file = await purchaseService.uploadPurchaseFile(req.businessId, parseInt(id, 10), req.file);
    sendSuccess(res, httpStatus.CREATED, 'Image uploaded successfully', file);
  }),
];

const listPurchaseFiles = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const files = await purchaseService.listPurchaseFiles(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Purchase files fetched', files);
});

const deletePurchaseFile = asyncHandler(async (req, res) => {
  const { id, fileId } = req.params;
  await purchaseService.deletePurchaseFile(req.businessId, parseInt(id, 10), parseInt(fileId, 10));
  sendSuccess(res, httpStatus.OK, 'File deleted successfully', null);
});

const deletePaymentOut = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await purchaseService.deletePaymentOut(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Payment Out receipt deleted successfully', result);
});

const purchaseController = {
  createPurchase,
  listPurchases,
  getPurchase,
  deletePurchase,
  updatePurchase,
  listPaymentsOut,
  createPaymentOut,
  updatePaymentOut,
  deletePaymentOut,
  createPurchaseReturn,
  listPurchaseReturns,
  getPurchaseReturn,
  updatePurchaseReturn,
  deletePurchaseReturn,
  uploadPurchaseFile,
  listPurchaseFiles,
  deletePurchaseFile,
};

export { purchaseController };
export default purchaseController;
