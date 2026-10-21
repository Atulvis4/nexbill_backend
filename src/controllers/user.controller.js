import userService from '../services/user.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.user.id);
  sendSuccess(res, httpStatus.OK, 'Profile fetched successfully', { user });
});

const userController = {
  getProfile,
};

export { userController };
export default userController;
