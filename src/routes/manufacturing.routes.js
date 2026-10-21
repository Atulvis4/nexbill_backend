import { Router } from 'express';
import manufacturingController from '../controllers/manufacturing.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';
import validate from '../middlewares/validate.js';
import { executeDirectSchema, previewSchema } from '../validators/manufacturing.validator.js';

const manufacturingRoutes = Router();

// Apply auth and active business middlewares
manufacturingRoutes.use(authenticate);
manufacturingRoutes.use(extractBusiness);

// Route mappings
manufacturingRoutes.get('/orders', manufacturingController.listOrders);
manufacturingRoutes.post('/orders', validate(executeDirectSchema), manufacturingController.executeDirect);
manufacturingRoutes.get('/preview', validate(previewSchema), manufacturingController.previewManufacturing);

export { manufacturingRoutes };
export default manufacturingRoutes;
