import fs from 'fs';
import backupService from '../services/backup.service.js';
import vyaparImporterService from '../services/vyaparImporter.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';
import logger from '../utils/logger.js';

const exportBackup = asyncHandler(async (req, res) => {
  const snapshot = await backupService.exportBackup(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Backup snapshot exported successfully', snapshot);
});

const restoreBackup = asyncHandler(async (req, res) => {
  let backupData;
  const filePath = req.file?.path || req.body?.filePath;

  try {
    if (filePath) {
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({
          success: false,
          message: `Backup file not found at: ${filePath}`,
        });
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      backupData = JSON.parse(raw);
    } else if (req.body?.data) {
      backupData = req.body;
    } else if (typeof req.body === 'string') {
      backupData = JSON.parse(req.body);
    } else {
      backupData = req.body;
    }

    if (!backupData || (typeof backupData !== 'object' && typeof backupData !== 'string')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup data provided. Please provide a valid JSON backup.',
      });
    }

    const cleanExisting = req.body?.cleanExisting === 'true' || req.body?.cleanExisting === true;
    logger.info(`Received JSON backup restore request for businessId: ${req.businessId}, cleanExisting: ${cleanExisting}`);
    const result = await backupService.restoreBackup(req.businessId, backupData, { cleanExisting });
    sendSuccess(res, httpStatus.OK, 'Backup snapshot restored & merged successfully', result);
  } finally {
    // If uploaded via multipart form-data, remove temp file from disk
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        logger.warn(`Could not remove temp uploaded JSON backup file ${req.file.path}: ${err.message}`);
      }
    }
  }
});

const uploadVyaparBackup = asyncHandler(async (req, res) => {
  const filePath = req.file?.path || req.body?.filePath;

  if (!filePath) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a Vyapar backup file (.vyp, .vyb, .sqlite) or JSON backup file (.json) or server filePath.',
    });
  }

  logger.info(`Received backup import request for businessId: ${req.businessId}, file: ${filePath}`);

  try {
    // Check if the file is a JSON backup
    const isJson = filePath.toLowerCase().endsWith('.json');
    if (isJson) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const backupData = JSON.parse(raw);
      const cleanExisting = req.body?.cleanExisting === 'true' || req.body?.cleanExisting === true;
      const summary = await backupService.restoreBackup(req.businessId, backupData, { cleanExisting });
      return sendSuccess(res, httpStatus.OK, 'JSON backup restored & merged successfully', summary);
    }

    const summary = await vyaparImporterService.importVyaparBackup(req.businessId, filePath);
    sendSuccess(res, httpStatus.OK, 'Vyapar backup imported successfully', summary);
  } finally {
    // If uploaded via multipart form-data, remove temp file from disk
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        logger.warn(`Could not remove temp uploaded file ${req.file.path}: ${err.message}`);
      }
    }
  }
});

const backupController = {
  exportBackup,
  restoreBackup,
  uploadVyaparBackup,
};

export { backupController };
export default backupController;
