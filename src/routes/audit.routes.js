import { Router } from 'express';
import auditController from '../controllers/audit.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';

const auditRoutes = Router();

auditRoutes.use(authenticate);
auditRoutes.use(extractBusiness);

auditRoutes.get('/', auditController.getDocumentAuditHistory);

export default auditRoutes;
