import backupService from '../services/backup.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const exportBackup = asyncHandler(async (req, res) => {
  const snapshot = await backupService.exportBackup(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Backup snapshot exported successfully', snapshot);
});

const restoreBackup = asyncHandler(async (req, res) => {
  const result = await backupService.restoreBackup(req.businessId, req.body);
  sendSuccess(res, httpStatus.OK, 'Backup snapshot restored successfully', result);
});

const backupController = {
  exportBackup,
  restoreBackup,
};

export { backupController };
export default backupController;
