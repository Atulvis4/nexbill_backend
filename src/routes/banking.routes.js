import { Router } from 'express';
import bankingController from '../controllers/banking.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';
import validate from '../middlewares/validate.js';
import { createAccountSchema, createTransactionSchema } from '../validators/banking.validator.js';

const bankingRoutes = Router();

bankingRoutes.use(authenticate);
bankingRoutes.use(extractBusiness);

bankingRoutes.get('/accounts', bankingController.listAccounts);
bankingRoutes.post('/accounts', validate(createAccountSchema), bankingController.createAccount);
bankingRoutes.get('/transactions', bankingController.listTransactions);
bankingRoutes.post('/transactions', validate(createTransactionSchema), bankingController.createTransaction);

export { bankingRoutes };
export default bankingRoutes;
