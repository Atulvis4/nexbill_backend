import reportService from '../services/report.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await reportService.getDashboardSummary(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Dashboard summary fetched successfully', summary);
});

const getSalesTrend = asyncHandler(async (req, res) => {
  const { days } = req.query;
  const trend = await reportService.getSalesTrend(req.businessId, days ? parseInt(days, 10) : 30);
  sendSuccess(res, httpStatus.OK, 'Sales trend fetched successfully', trend);
});

const getSalesReport = asyncHandler(async (req, res) => {
  const { fromDate, toDate, partyId } = req.query;
  const report = await reportService.getSalesReport(req.businessId, fromDate, toDate, partyId);
  sendSuccess(res, httpStatus.OK, 'Sales report generated successfully', report);
});

const getPurchaseReport = asyncHandler(async (req, res) => {
  const { fromDate, toDate, partyId } = req.query;
  const report = await reportService.getPurchaseReport(req.businessId, fromDate, toDate, partyId);
  sendSuccess(res, httpStatus.OK, 'Purchase report generated successfully', report);
});

const getDaybookReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const daybook = await reportService.getDaybookReport(req.businessId, date);
  sendSuccess(res, httpStatus.OK, 'Daybook report generated successfully', daybook);
});

const getStockSummaryReport = asyncHandler(async (req, res) => {
  const { categoryId, lowStock } = req.query;
  const summary = await reportService.getStockSummaryReport(req.businessId, categoryId, lowStock);
  sendSuccess(res, httpStatus.OK, 'Stock summary report generated successfully', summary);
});

const getProfitLossReport = asyncHandler(async (req, res) => {
  const { fromDate, toDate } = req.query;
  const report = await reportService.getProfitLossReport(req.businessId, fromDate, toDate);
  sendSuccess(res, httpStatus.OK, 'Profit & loss statement generated successfully', report);
});

const getBalanceSheetReport = asyncHandler(async (req, res) => {
  const report = await reportService.getBalanceSheetReport(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Balance sheet generated successfully', report);
});

const getGrowthSummary = asyncHandler(async (req, res) => {
  const summary = await reportService.getGrowthSummary(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Growth KPI summary fetched successfully', summary);
});

const getOverdueParties = asyncHandler(async (req, res) => {
  const list = await reportService.getOverdueParties(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Overdue customer reminders list fetched successfully', list);
});

const getTopSellingItems = asyncHandler(async (req, res) => {
  const { fromDate, toDate, limit } = req.query;
  const data = await reportService.getTopSellingItems(req.businessId, fromDate, toDate, limit ? parseInt(limit, 10) : 10);
  sendSuccess(res, httpStatus.OK, 'Top selling items fetched successfully', data);
});

const getTopCustomerParties = asyncHandler(async (req, res) => {
  const { fromDate, toDate, limit } = req.query;
  const data = await reportService.getTopCustomerParties(req.businessId, fromDate, toDate, limit ? parseInt(limit, 10) : 10);
  sendSuccess(res, httpStatus.OK, 'Top customer parties fetched successfully', data);
});

const getTopSupplierParties = asyncHandler(async (req, res) => {
  const { fromDate, toDate, limit } = req.query;
  const data = await reportService.getTopSupplierParties(req.businessId, fromDate, toDate, limit ? parseInt(limit, 10) : 10);
  sendSuccess(res, httpStatus.OK, 'Top supplier parties fetched successfully', data);
});

const reportController = {
  getDashboardSummary,
  getSalesTrend,
  getSalesReport,
  getPurchaseReport,
  getDaybookReport,
  getStockSummaryReport,
  getProfitLossReport,
  getBalanceSheetReport,
  getGrowthSummary,
  getOverdueParties,
  getTopSellingItems,
  getTopCustomerParties,
  getTopSupplierParties,
};

export { reportController };
export default reportController;
