import salesService from '../services/sales.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';
import upload from '../utils/upload.js';

// =========================================================================
// INVOICES
// =========================================================================

const createInvoice = asyncHandler(async (req, res) => {
  const invoice = await salesService.createInvoice(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Sales invoice created successfully', invoice);
});

const listInvoices = asyncHandler(async (req, res) => {
  const { search, fromDate, toDate, partyId } = req.query;
  const invoices = await salesService.listInvoices(req.businessId, search, fromDate, toDate, partyId);
  sendSuccess(res, httpStatus.OK, 'Sales invoices fetched successfully', invoices);
});

const getInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const invoice = await salesService.getInvoice(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Sales invoice fetched successfully', invoice);
});

const deleteInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await salesService.deleteInvoice(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Sales invoice deleted/reversed successfully', result);
});

const listDeletedInvoices = asyncHandler(async (req, res) => {
  const invoices = await salesService.listDeletedInvoices(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Deleted sales invoices fetched successfully', invoices);
});

const getInvoicePdf = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Stub for invoice PDF generation
  sendSuccess(res, httpStatus.OK, 'Invoice PDF metadata generated', {
    invoiceId: parseInt(id, 10),
    pdfUrl: `/uploads/invoices/invoice-${id}.pdf`,
  });
});

const shareInvoice = asyncHandler(async (req, res) => {
  // Stub for invoice sharing
  sendSuccess(res, httpStatus.OK, 'Invoice shared successfully', { shared: true });
});

// =========================================================================
// ESTIMATES
// =========================================================================

const createEstimate = asyncHandler(async (req, res) => {
  const estimate = await salesService.createEstimate(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Estimate created successfully', estimate);
});

const listEstimates = asyncHandler(async (req, res) => {
  const estimates = await salesService.listEstimates(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Estimates fetched successfully', estimates);
});

const deleteEstimate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await salesService.deleteEstimate(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Estimate deleted successfully', result);
});

const convertEstimate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const invoice = await salesService.convertEstimateToInvoice(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.CREATED, 'Estimate converted to invoice successfully', invoice);
});

// =========================================================================
// PAYMENTS IN
// =========================================================================

const createPaymentIn = asyncHandler(async (req, res) => {
  const payment = await salesService.createPaymentIn(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Payment receipt created successfully', payment);
});

const listPaymentsIn = asyncHandler(async (req, res) => {
  const payments = await salesService.listPaymentsIn(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Payment receipts fetched successfully', payments);
});

// =========================================================================
// RETURNS / CREDIT NOTES
// =========================================================================

const createReturn = asyncHandler(async (req, res) => {
  const sreturn = await salesService.createReturn(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Sales return credit note created successfully', sreturn);
});

const listReturns = asyncHandler(async (req, res) => {
  const returns = await salesService.listReturns(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Sales returns credit notes fetched successfully', returns);
});

// =========================================================================
// CHALLANS
// =========================================================================

const createChallan = asyncHandler(async (req, res) => {
  const challan = await salesService.createChallan(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Delivery challan created successfully', challan);
});

const listChallans = asyncHandler(async (req, res) => {
  const challans = await salesService.listChallans(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Delivery challans fetched successfully', challans);
});

const updateChallanStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const updated = await salesService.updateChallanStatus(req.businessId, parseInt(id, 10), status);
  sendSuccess(res, httpStatus.OK, 'Challan status updated successfully', updated);
});

const convertChallan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const invoice = await salesService.convertChallanToInvoice(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.CREATED, 'Challan converted to invoice successfully', invoice);
});

// =========================================================================
// ORDERS
// =========================================================================

const createOrder = asyncHandler(async (req, res) => {
  const order = await salesService.createOrder(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Sales order created successfully', order);
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await salesService.listOrders(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Sales orders fetched successfully', orders);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const updated = await salesService.updateOrderStatus(req.businessId, parseInt(id, 10), status);
  sendSuccess(res, httpStatus.OK, 'Sales order status updated successfully', updated);
});

const convertOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const invoice = await salesService.convertOrderToInvoice(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.CREATED, 'Sales order converted to invoice successfully', invoice);
});

const updateInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await salesService.updateInvoice(req.businessId, parseInt(id, 10), req.body, req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Sales invoice updated successfully', updated);
});

const updateEstimate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const estimate = await salesService.updateEstimate(req.businessId, parseInt(id, 10), req.body, req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Estimate updated successfully', estimate);
});

// =========================================================================
// FILE ATTACHMENTS (Sales Invoice)
// =========================================================================

const uploadInvoiceFile = [
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.file) throw { status: 400, message: 'No file uploaded' };
    const file = await salesService.uploadInvoiceFile(req.businessId, parseInt(id, 10), req.file);
    sendSuccess(res, httpStatus.CREATED, 'Image uploaded successfully', file);
  }),
];

const listInvoiceFiles = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const files = await salesService.listInvoiceFiles(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Invoice files fetched', files);
});

const deleteInvoiceFile = asyncHandler(async (req, res) => {
  const { id, fileId } = req.params;
  await salesService.deleteInvoiceFile(req.businessId, parseInt(id, 10), parseInt(fileId, 10));
  sendSuccess(res, httpStatus.OK, 'File deleted successfully', null);
});

const updatePaymentIn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await salesService.updatePaymentIn(req.businessId, parseInt(id, 10), req.body, req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Payment In updated successfully', updated);
});

const updateReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await salesService.updateReturn(req.businessId, parseInt(id, 10), req.body, req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Sales Return updated successfully', updated);
});

const updateChallan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await salesService.updateChallan(req.businessId, parseInt(id, 10), req.body, req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Delivery Challan updated successfully', updated);
});

const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await salesService.updateOrder(req.businessId, parseInt(id, 10), req.body, req.user?.id);
  sendSuccess(res, httpStatus.OK, 'Sales Order updated successfully', updated);
});

const deletePaymentIn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await salesService.deletePaymentIn(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Payment receipt deleted successfully', result);
});

const deleteReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await salesService.deleteReturn(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Sales return credit note deleted successfully', result);
});

const updateDocumentTitle = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const { customTitle } = req.body;
  const updated = await salesService.updateDocumentTitle(req.businessId, type, id, customTitle);
  sendSuccess(res, httpStatus.OK, 'Document header title updated successfully', updated);
});

const salesController = {
  createInvoice,
  listInvoices,
  getInvoice,
  deleteInvoice,
  updateInvoice,
  listDeletedInvoices,
  getInvoicePdf,
  shareInvoice,
  createEstimate,
  listEstimates,
  deleteEstimate,
  updateEstimate,
  convertEstimate,
  createPaymentIn,
  listPaymentsIn,
  updatePaymentIn,
  deletePaymentIn,
  createReturn,
  listReturns,
  updateReturn,
  deleteReturn,
  createChallan,
  listChallans,
  updateChallanStatus,
  updateChallan,
  convertChallan,
  createOrder,
  listOrders,
  updateOrderStatus,
  updateOrder,
  convertOrder,
  uploadInvoiceFile,
  listInvoiceFiles,
  deleteInvoiceFile,
  updateDocumentTitle,
};

export { salesController };
export default salesController;
