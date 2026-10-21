import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import validate from '../middlewares/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

const authRoutes = Router();

authRoutes.post('/register', validate(registerSchema), authController.register);
authRoutes.post('/login', validate(loginSchema), authController.login);

export { authRoutes };
export default authRoutes;
