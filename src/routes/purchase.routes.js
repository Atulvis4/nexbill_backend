import { Router } from 'express';
import purchaseController from '../controllers/purchase.controller.js';
import salesController from '../controllers/sales.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';
import validate from '../middlewares/validate.js';
import { createPurchaseSchema, createPaymentOutSchema, createPurchaseReturnSchema } from '../validators/purchase.validator.js';

const purchaseRoutes = Router();

purchaseRoutes.use(authenticate);
purchaseRoutes.use(extractBusiness);

purchaseRoutes.patch('/documents/:type/:id/title', salesController.updateDocumentTitle);
purchaseRoutes.patch('/invoices/:id/title', (req, res, next) => {
  req.params.type = 'purchase';
  return salesController.updateDocumentTitle(req, res, next);
});

purchaseRoutes.get('/invoices', purchaseController.listPurchases);
purchaseRoutes.post('/invoices', validate(createPurchaseSchema), purchaseController.createPurchase);
purchaseRoutes.put('/invoices/:id', validate(createPurchaseSchema), purchaseController.updatePurchase);
purchaseRoutes.get('/invoices/:id', purchaseController.getPurchase);
purchaseRoutes.delete('/invoices/:id', purchaseController.deletePurchase);
// Purchase file attachments
purchaseRoutes.post('/invoices/:id/files', ...purchaseController.uploadPurchaseFile);
purchaseRoutes.get('/invoices/:id/files', purchaseController.listPurchaseFiles);
purchaseRoutes.delete('/invoices/:id/files/:fileId', purchaseController.deletePurchaseFile);

// Payments Out
purchaseRoutes.get('/payments-out', purchaseController.listPaymentsOut);
purchaseRoutes.post('/payments-out', validate(createPaymentOutSchema), purchaseController.createPaymentOut);
purchaseRoutes.put('/payments-out/:id', validate(createPaymentOutSchema), purchaseController.updatePaymentOut);
purchaseRoutes.delete('/payments-out/:id', purchaseController.deletePaymentOut);

// Purchase Returns / Debit Notes
purchaseRoutes.get('/returns', purchaseController.listPurchaseReturns);
purchaseRoutes.post('/returns', validate(createPurchaseReturnSchema), purchaseController.createPurchaseReturn);
purchaseRoutes.put('/returns/:id', validate(createPurchaseReturnSchema), purchaseController.updatePurchaseReturn);
purchaseRoutes.delete('/returns/:id', purchaseController.deletePurchaseReturn);
purchaseRoutes.get('/returns/:id', purchaseController.getPurchaseReturn);

export { purchaseRoutes };
export default purchaseRoutes;
