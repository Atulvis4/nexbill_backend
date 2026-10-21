import { Router } from 'express';
import backupController from '../controllers/backup.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';

const backupRoutes = Router();

backupRoutes.use(authenticate);
backupRoutes.use(extractBusiness);

backupRoutes.post('/export', backupController.exportBackup);
backupRoutes.post('/restore', backupController.restoreBackup);

export { backupRoutes };
export default backupRoutes;
