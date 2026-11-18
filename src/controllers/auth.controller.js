import authService from '../services/auth.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, httpStatus.CREATED, 'User registered successfully', result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, httpStatus.OK, 'Login successful', result);
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  sendSuccess(res, httpStatus.OK, result.message || 'Password changed successfully', result);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  sendSuccess(res, httpStatus.OK, result.message || 'Reset code generated successfully', result);
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  sendSuccess(res, httpStatus.OK, result.message || 'Password reset successfully', result);
});

const authController = {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
};

export { authController };
export default authController;
