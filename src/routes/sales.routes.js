import { Router } from 'express';
import salesController from '../controllers/sales.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';
import validate from '../middlewares/validate.js';
import {
  createInvoiceSchema,
  createEstimateSchema,
  createPaymentInSchema,
  createReturnSchema,
  createChallanSchema,
  createOrderSchema,
} from '../validators/sales.validator.js';

const salesRoutes = Router();

// Apply auth and active business middlewares to all routes
salesRoutes.use(authenticate);
salesRoutes.use(extractBusiness);

// Invoices
salesRoutes.get('/invoices', salesController.listInvoices);
salesRoutes.post('/invoices', validate(createInvoiceSchema), salesController.createInvoice);
salesRoutes.put('/invoices/:id', validate(createInvoiceSchema), salesController.updateInvoice);
salesRoutes.patch('/documents/:type/:id/title', salesController.updateDocumentTitle);
salesRoutes.patch('/sales/documents/:type/:id/title', salesController.updateDocumentTitle);
salesRoutes.patch('/invoices/:id/title', (req, res, next) => {
  req.params.type = 'invoice';
  return salesController.updateDocumentTitle(req, res, next);
});
// IMPORTANT: /invoices/deleted must be registered before /invoices/:id
salesRoutes.get('/invoices/deleted', salesController.listDeletedInvoices);
salesRoutes.get('/invoices/:id', salesController.getInvoice);
salesRoutes.delete('/invoices/:id', salesController.deleteInvoice);
salesRoutes.get('/invoices/:id/pdf', salesController.getInvoicePdf);
salesRoutes.post('/invoices/:id/share', salesController.shareInvoice);
salesRoutes.post('/invoices/:id/payments', validate(createPaymentInSchema), salesController.createPaymentIn);
// Invoice file attachments
salesRoutes.post('/invoices/:id/files', ...salesController.uploadInvoiceFile);
salesRoutes.get('/invoices/:id/files', salesController.listInvoiceFiles);
salesRoutes.delete('/invoices/:id/files/:fileId', salesController.deleteInvoiceFile);

// Estimates
salesRoutes.get('/estimates', salesController.listEstimates);
salesRoutes.post('/estimates', validate(createEstimateSchema), salesController.createEstimate);
salesRoutes.put('/estimates/:id', validate(createEstimateSchema), salesController.updateEstimate);
salesRoutes.delete('/estimates/:id', salesController.deleteEstimate);
salesRoutes.post('/estimates/:id/convert-to-invoice', salesController.convertEstimate);

// Payments In
salesRoutes.get('/payments-in', salesController.listPaymentsIn);
salesRoutes.post('/payments-in', validate(createPaymentInSchema), salesController.createPaymentIn);
salesRoutes.put('/payments-in/:id', validate(createPaymentInSchema), salesController.updatePaymentIn);
salesRoutes.delete('/payments-in/:id', salesController.deletePaymentIn);

// Returns / Credit Notes
salesRoutes.get('/returns', salesController.listReturns);
salesRoutes.post('/returns', validate(createReturnSchema), salesController.createReturn);
salesRoutes.put('/returns/:id', validate(createReturnSchema), salesController.updateReturn);
salesRoutes.delete('/returns/:id', salesController.deleteReturn);

// Delivery Challans
salesRoutes.get('/challans', salesController.listChallans);
salesRoutes.post('/challans', validate(createChallanSchema), salesController.createChallan);
salesRoutes.put('/challans/:id', validate(createChallanSchema), salesController.updateChallan);
salesRoutes.put('/challans/:id/status', salesController.updateChallanStatus);
salesRoutes.post('/challans/:id/convert-to-invoice', salesController.convertChallan);

// Sales Orders
salesRoutes.get('/orders', salesController.listOrders);
salesRoutes.post('/orders', validate(createOrderSchema), salesController.createOrder);
salesRoutes.put('/orders/:id', validate(createOrderSchema), salesController.updateOrder);
salesRoutes.put('/orders/:id/status', salesController.updateOrderStatus);
salesRoutes.post('/orders/:id/convert-to-invoice', salesController.convertOrder);

export { salesRoutes };
export default salesRoutes;
