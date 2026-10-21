import { Router } from 'express';
import reportController from '../controllers/report.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';

const reportRoutes = Router();

reportRoutes.use(authenticate);
reportRoutes.use(extractBusiness);

// Dashboard routes
reportRoutes.get('/dashboard/summary', reportController.getDashboardSummary);
reportRoutes.get('/dashboard/sales-trend', reportController.getSalesTrend);

// Reports routes
reportRoutes.get('/reports/sales', reportController.getSalesReport);
reportRoutes.get('/reports/purchases', reportController.getPurchaseReport);
reportRoutes.get('/reports/daybook', reportController.getDaybookReport);
reportRoutes.get('/reports/stock-summary', reportController.getStockSummaryReport);
reportRoutes.get('/reports/profit-loss', reportController.getProfitLossReport);
reportRoutes.get('/reports/balance-sheet', reportController.getBalanceSheetReport);

// Growth routes
reportRoutes.get('/growth/summary', reportController.getGrowthSummary);
reportRoutes.get('/growth/overdue-parties', reportController.getOverdueParties);

// Analytics: Top Performers routes
reportRoutes.get('/reports/top-items', reportController.getTopSellingItems);
reportRoutes.get('/reports/top-customers', reportController.getTopCustomerParties);
reportRoutes.get('/reports/top-suppliers', reportController.getTopSupplierParties);

export { reportRoutes };
export default reportRoutes;
