import httpStatus from '../config/constants.js';
import auditService from '../services/audit.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

const getDocumentAuditHistory = asyncHandler(async (req, res) => {
  const { businessId } = req;
  const { type, id } = req.query;

  const history = await auditService.getDocumentAuditHistory(businessId, type, id);
  sendSuccess(res, httpStatus.OK, 'Document audit history fetched successfully', history);
});

export default {
  getDocumentAuditHistory
};
