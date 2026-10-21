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

const authController = {
  register,
  login,
};

export { authController };
export default authController;
