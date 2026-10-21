import { Router } from 'express';
import multer from 'multer';
import businessController from '../controllers/business.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';
import validate from '../middlewares/validate.js';
import {
  updateProfileSchema,
  updateSettingsSchema,
  updateNumberingSchema,
} from '../validators/business.validator.js';

const upload = multer({ dest: 'uploads/' });
const businessRoutes = Router();

// Apply auth and active business middlewares to all routes here
businessRoutes.use(authenticate);
businessRoutes.use(extractBusiness);

// Company Profile Routes
businessRoutes.get('/company/profile', businessController.getProfile);
businessRoutes.put(
  '/company/profile',
  validate(updateProfileSchema),
  businessController.updateProfile
);
businessRoutes.post('/company/logo', upload.single('logo'), businessController.uploadLogo);
businessRoutes.post(
  '/company/signature',
  upload.single('signature'),
  businessController.uploadSignature
);

// Settings Routes
businessRoutes.get('/settings', businessController.getSettings);
businessRoutes.put('/settings', validate(updateSettingsSchema), businessController.updateSettings);

// Numbering Routes
businessRoutes.get('/settings/numbering', businessController.getNumbering);
businessRoutes.put(
  '/settings/numbering',
  validate(updateNumberingSchema),
  businessController.updateNumbering
);
businessRoutes.post('/settings/numbering/next', businessController.getNextNumber);

export { businessRoutes };
export default businessRoutes;
