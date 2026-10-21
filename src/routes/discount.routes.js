import { Router } from 'express';
import discountController from '../controllers/discount.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';
import validate from '../middlewares/validate.js';
import { createDiscountSchema, updateDiscountSchema } from '../validators/discount.validator.js';

const discountRoutes = Router();

discountRoutes.use(authenticate);
discountRoutes.use(extractBusiness);

discountRoutes.get('/', discountController.listDiscounts);
discountRoutes.post('/', validate(createDiscountSchema), discountController.createDiscount);
discountRoutes.get('/:id', discountController.getDiscount);
discountRoutes.put('/:id', validate(updateDiscountSchema), discountController.updateDiscount);
discountRoutes.delete('/:id', discountController.deleteDiscount);

export { discountRoutes };
export default discountRoutes;
