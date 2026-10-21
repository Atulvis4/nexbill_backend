import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import authenticate from '../middlewares/authenticate.js';
import { requireRole, requirePermission } from '../middlewares/authorize.js';
import sendSuccess from '../utils/response.js';
import httpStatus from '../config/constants.js';

const userRoutes = Router();

userRoutes.get('/me', authenticate, userController.getProfile);

// Demo route restricted to ADMIN role
userRoutes.get('/admin-only', authenticate, requireRole('ADMIN'), (req, res) => {
  sendSuccess(res, httpStatus.OK, 'Access granted to ADMIN role successfully', {
    user: req.user,
  });
});

// Demo route restricted to users with manage:users permission
userRoutes.get('/manage-users-only', authenticate, requirePermission('manage:users'), (req, res) => {
  sendSuccess(res, httpStatus.OK, 'Access granted to manage:users permission successfully', {
    user: req.user,
  });
});

export { userRoutes };
export default userRoutes;
