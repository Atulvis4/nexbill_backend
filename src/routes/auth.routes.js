import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import authenticate from '../middlewares/authenticate.js';
import validate from '../middlewares/validate.js';
import {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
} from '../middlewares/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordRequestSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js';

const authRoutes = Router();

authRoutes.post('/register', validate(registerSchema), authController.register);
authRoutes.post('/login', loginLimiter, validate(loginSchema), authController.login);

// Authenticated password reset / change (Inside Settings page)
authRoutes.post('/change-password', authenticate, changePasswordLimiter, validate(changePasswordSchema), authController.changePassword);
authRoutes.post('/reset-password-auth', authenticate, changePasswordLimiter, validate(changePasswordSchema), authController.changePassword);

// Unauthenticated forgot password flow
authRoutes.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordRequestSchema), authController.forgotPassword);
authRoutes.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), authController.resetPassword);
authRoutes.post('/forgot-password/reset', resetPasswordLimiter, validate(resetPasswordSchema), authController.resetPassword);

export { authRoutes };
export default authRoutes;
