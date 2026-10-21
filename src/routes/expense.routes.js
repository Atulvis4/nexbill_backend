import { Router } from 'express';
import expenseController from '../controllers/expense.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';
import validate from '../middlewares/validate.js';
import { createExpenseSchema, updateExpenseSchema } from '../validators/expense.validator.js';

const expenseRoutes = Router();

expenseRoutes.use(authenticate);
expenseRoutes.use(extractBusiness);

expenseRoutes.get('/', expenseController.listExpenses);
expenseRoutes.post('/', validate(createExpenseSchema), expenseController.createExpense);
expenseRoutes.put('/:id', validate(updateExpenseSchema), expenseController.updateExpense);
expenseRoutes.delete('/:id', expenseController.deleteExpense);

export { expenseRoutes };
export default expenseRoutes;
