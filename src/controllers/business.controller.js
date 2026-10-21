import businessService from '../services/business.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const getProfile = asyncHandler(async (req, res) => {
  const profile = await businessService.getProfile(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Company profile fetched successfully', profile);
});

const updateProfile = asyncHandler(async (req, res) => {
  const updated = await businessService.updateProfile(req.businessId, req.body);
  sendSuccess(res, httpStatus.OK, 'Company profile updated successfully', updated);
});

const getSettings = asyncHandler(async (req, res) => {
  const settings = await businessService.getSettings(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Company settings fetched successfully', settings);
});

const updateSettings = asyncHandler(async (req, res) => {
  const updated = await businessService.updateSettings(req.businessId, req.body);
  sendSuccess(res, httpStatus.OK, 'Company settings updated successfully', updated);
});

const getNumbering = asyncHandler(async (req, res) => {
  const numbering = await businessService.getNumbering(req.businessId);
  sendSuccess(res, httpStatus.OK, 'Numbering settings fetched successfully', numbering);
});

const updateNumbering = asyncHandler(async (req, res) => {
  const updated = await businessService.updateNumbering(req.businessId, req.body);
  sendSuccess(res, httpStatus.OK, 'Numbering settings updated successfully', updated);
});

const getNextNumber = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const nextNum = await businessService.getNextNumber(req.businessId, type || 'sales');
  sendSuccess(res, httpStatus.OK, 'Next number retrieved successfully', nextNum);
});

const uploadLogo = asyncHandler(async (req, res) => {
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.logoUrl || '');
  const updated = await businessService.uploadLogo(req.businessId, fileUrl);
  sendSuccess(res, httpStatus.OK, 'Logo uploaded successfully', updated);
});

const uploadSignature = asyncHandler(async (req, res) => {
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.signatureUrl || '');
  const updated = await businessService.uploadSignature(req.businessId, fileUrl);
  sendSuccess(res, httpStatus.OK, 'Signature uploaded successfully', updated);
});

const businessController = {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  getNumbering,
  updateNumbering,
  getNextNumber,
  uploadLogo,
  uploadSignature,
};

export { businessController };
export default businessController;
