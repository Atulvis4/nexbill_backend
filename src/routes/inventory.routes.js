import { Router } from 'express';
import inventoryController from '../controllers/inventory.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';
import validate from '../middlewares/validate.js';
import {
  createItemSchema,
  updateItemSchema,
  adjustStockSchema,
  createCategorySchema,
  updateCategorySchema,
  createUnitSchema,
  updateUnitSchema,
  createBomSchema,
} from '../validators/inventory.validator.js';

const inventoryRoutes = Router();

// Apply auth and active business middlewares
inventoryRoutes.use(authenticate);
inventoryRoutes.use(extractBusiness);

// Category Routes
inventoryRoutes.get('/categories', inventoryController.listCategories);
inventoryRoutes.post('/categories', validate(createCategorySchema), inventoryController.createCategory);
inventoryRoutes.put('/categories/:id', validate(updateCategorySchema), inventoryController.updateCategory);
inventoryRoutes.delete('/categories/:id', inventoryController.deleteCategory);

// Unit Routes
inventoryRoutes.get('/units', inventoryController.listUnits);
inventoryRoutes.post('/units', validate(createUnitSchema), inventoryController.createUnit);
inventoryRoutes.put('/units/:id', validate(updateUnitSchema), inventoryController.updateUnit);
inventoryRoutes.delete('/units/:id', inventoryController.deleteUnit);

// Item Routes
inventoryRoutes.get('/items', inventoryController.listItems);
inventoryRoutes.post('/items', validate(createItemSchema), inventoryController.createItem);
inventoryRoutes.get('/items/:id', inventoryController.getItem);
inventoryRoutes.put('/items/:id', validate(updateItemSchema), inventoryController.updateItem);
inventoryRoutes.delete('/items/:id', inventoryController.deleteItem);

// Stock Adjustments & History
inventoryRoutes.post('/items/:id/stock-adjustments', validate(adjustStockSchema), inventoryController.adjustStock);
inventoryRoutes.get('/items/:id/stock-ledger', inventoryController.getStockLedger);
inventoryRoutes.get('/items/:id/transactions', inventoryController.getItemTransactions);

// Bill of Materials
inventoryRoutes.get('/items/:id/bom', inventoryController.getBom);
inventoryRoutes.put('/items/:id/bom', validate(createBomSchema), inventoryController.upsertBom);

export { inventoryRoutes };
export default inventoryRoutes;
