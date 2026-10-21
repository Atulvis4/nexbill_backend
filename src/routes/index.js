import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import businessRoutes from './business.routes.js';
import partyRoutes from './party.routes.js';
import inventoryRoutes from './inventory.routes.js';
import salesRoutes from './sales.routes.js';
import purchaseRoutes from './purchase.routes.js';
import bankingRoutes from './banking.routes.js';
import expenseRoutes from './expense.routes.js';
import reportRoutes from './report.routes.js';
import backupRoutes from './backup.routes.js';
import discountRoutes from './discount.routes.js';
import manufacturingRoutes from './manufacturing.routes.js';
import auditRoutes from './audit.routes.js';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/users', userRoutes);
routes.use('/parties', partyRoutes);
routes.use('/purchases', purchaseRoutes);
routes.use('/banking', bankingRoutes);
routes.use('/expenses', expenseRoutes);
routes.use('/backup', backupRoutes);
routes.use('/discounts', discountRoutes);
routes.use('/manufacturing', manufacturingRoutes);
routes.use('/audit-logs', auditRoutes);

// Routers containing root-level paths (/items, /categories, /units, /company, /settings, /dashboard, /reports, /growth)
routes.use('/', businessRoutes);
routes.use('/', inventoryRoutes);
routes.use('/', salesRoutes);
routes.use('/', reportRoutes);

export { routes };
export default routes;
