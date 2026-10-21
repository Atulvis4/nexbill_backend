import partyService from '../services/party.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const listParties = asyncHandler(async (req, res) => {
  const { search, balanceType, sortByAmount, sortBy, sortOrder, minAmount, maxAmount, state } = req.query;
  const parties = await partyService.listParties(req.businessId, {
    search, balanceType, sortByAmount, sortBy, sortOrder, minAmount, maxAmount, state,
  });
  sendSuccess(res, httpStatus.OK, 'Parties listed successfully', parties);
});

const createParty = asyncHandler(async (req, res) => {
  const party = await partyService.createParty(req.businessId, req.body);
  sendSuccess(res, httpStatus.CREATED, 'Party created successfully', party);
});

const getParty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const party = await partyService.getParty(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Party details fetched successfully', party);
});

const updateParty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await partyService.updateParty(req.businessId, parseInt(id, 10), req.body);
  sendSuccess(res, httpStatus.OK, 'Party updated successfully', updated);
});

const deleteParty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await partyService.deleteParty(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Party deleted/archived successfully', result);
});

const getPartyLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ledger = await partyService.getPartyLedger(req.businessId, parseInt(id, 10), req.query);
  sendSuccess(res, httpStatus.OK, 'Party ledger statements fetched successfully', ledger);
});

const getPartyBalance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const balance = await partyService.getPartyBalance(req.businessId, parseInt(id, 10));
  sendSuccess(res, httpStatus.OK, 'Party outstanding balances fetched successfully', balance);
});

const partyController = {
  listParties,
  createParty,
  getParty,
  updateParty,
  deleteParty,
  getPartyLedger,
  getPartyBalance,
};

export { partyController };
export default partyController;
