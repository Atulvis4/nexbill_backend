import inventoryService from '../services/inventory.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

// =========================================================================
// CATEGORY CONTROLLERS
// =========================================================================

const listCategories = asyncHandler(async (req, res) => {
  const categories = await inventoryService.listCategories(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Categories fetched successfully', categories);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await inventoryService.createCategory(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Category created successfully', category);
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await inventoryService.updateCategory(req.businessId, parseInt(id, 10), req.body);
  sendSuccess(res, httpStatus.OK, 'Category updated successfully', updated);
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await inventoryService.deleteCategory(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Category deleted successfully', result);
});

// =========================================================================
// UNIT CONTROLLERS
// =========================================================================

const listUnits = asyncHandler(async (req, res) => {
  const units = await inventoryService.listUnits(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Units fetched successfully', units);
});

const createUnit = asyncHandler(async (req, res) => {
  const unit = await inventoryService.createUnit(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Unit created successfully', unit);
});

const updateUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await inventoryService.updateUnit(req.businessId, parseInt(id, 10), req.body);
  sendSuccess(res, httpStatus.OK, 'Unit updated successfully', updated);
});

const deleteUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await inventoryService.deleteUnit(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Unit deleted successfully', result);
});

// =========================================================================
// ITEM CONTROLLERS
// =========================================================================

const listItems = asyncHandler(async (req, res) => {
  const { search, type } = req.query;
  const items = await inventoryService.listItems(req.businessId, search, type);
  sendSuccess(res, httpStatus.OK, 'Items fetched successfully', items);
});

const createItem = asyncHandler(async (req, res) => {
  const item = await inventoryService.createItem(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Item created successfully', item);
});

const getItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await inventoryService.getItem(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Item fetched successfully', item);
});

const updateItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await inventoryService.updateItem(req.businessId, parseInt(id, 10), req.body);
  sendSuccess(res, httpStatus.OK, 'Item updated successfully', updated);
});

const deleteItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await inventoryService.deleteItem(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Item archived successfully', result);
});

const adjustStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await inventoryService.adjustStock(req.businessId, parseInt(id, 10), req.body);
  sendSuccess(res, httpStatus.OK, 'Stock adjusted successfully', updated);
});

const getStockLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cursor, take, search } = req.query;
  console.log(`[controller] getStockLedger itemId=${id} businessId=${req.businessId} cursor=${cursor} take=${take} search=${search}`);
  const result = await inventoryService.getStockLedger(
    req.businessId,
    parseInt(id, 10),
    { cursor, take, search }
  );
  sendSuccess(res, httpStatus.OK, 'Stock ledger history fetched successfully', result);
});

const getItemTransactions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const transactions = await inventoryService.getItemTransactions(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Item transactions list fetched successfully', transactions);
});

const getBom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const bom = await inventoryService.getBom(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Bill of Materials fetched successfully', bom);
});

const upsertBom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { components } = req.body;
  const bom = await inventoryService.upsertBom(req.businessId, parseInt(id, 10), components);
  sendSuccess(res, httpStatus.OK, 'Bill of Materials saved successfully', bom);
});

const inventoryController = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  listItems,
  createItem,
  getItem,
  updateItem,
  deleteItem,
  adjustStock,
  getStockLedger,
  getItemTransactions,
  getBom,
  upsertBom,
};

export { inventoryController };
export default inventoryController;
