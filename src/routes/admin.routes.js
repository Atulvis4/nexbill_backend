import { Router } from 'express';
import adminController from '../controllers/admin.controller.js';

const adminRoutes = Router();

// Public Admin Auth
adminRoutes.post('/auth/login', adminController.login);

// Protected Admin Routes
adminRoutes.use(adminController.authenticateAdmin);

adminRoutes.get('/auth/me', adminController.getMe);
adminRoutes.get('/dashboard/stats', adminController.getDashboardStats);
adminRoutes.get('/organisations', adminController.listOrganisations);
adminRoutes.get('/users', adminController.listUsers);
adminRoutes.get('/plans', adminController.listPlans);
adminRoutes.get('/subscriptions', adminController.listSubscriptions);
adminRoutes.get('/payments', adminController.listPayments);
adminRoutes.get('/audit-logs', adminController.listAuditLogs);

export { adminRoutes };
export default adminRoutes;

