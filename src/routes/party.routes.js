import { Router } from 'express';
import partyController from '../controllers/party.controller.js';
import authenticate from '../middlewares/authenticate.js';
import extractBusiness from '../middlewares/extractBusiness.js';
import validate from '../middlewares/validate.js';
import { createPartySchema, updatePartySchema } from '../validators/party.validator.js';

const partyRoutes = Router();

partyRoutes.use(authenticate);
partyRoutes.use(extractBusiness);

partyRoutes.get('/', partyController.listParties);
partyRoutes.post('/', validate(createPartySchema), partyController.createParty);
partyRoutes.get('/:id', partyController.getParty);
partyRoutes.put('/:id', validate(updatePartySchema), partyController.updateParty);
partyRoutes.delete('/:id', partyController.deleteParty);
partyRoutes.get('/:id/ledger', partyController.getPartyLedger);
partyRoutes.get('/:id/balance', partyController.getPartyBalance);

export { partyRoutes };
export default partyRoutes;
