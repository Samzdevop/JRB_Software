import { Router } from 'express';
import {
  addLivestock,
  getLivestock,
  updateLivestock,
  deleteLivestock,
  getAllLivestock,
} from '../contollers/livestock.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import {
  addLivestockSchema,
  updateLivestockSchema,
} from '../schemas/livestock.schemas';

export const livestockRouter = Router();

livestockRouter.post(
  '/',
  authenticateJWT,
  validateRequest(addLivestockSchema),
  addLivestock
);

livestockRouter.get('/', authenticateJWT, getAllLivestock);
livestockRouter.get('/:livestockId', authenticateJWT, getLivestock);
livestockRouter.patch(
  '/:livestockId',
  authenticateJWT,
  validateRequest(updateLivestockSchema),
  updateLivestock
);
livestockRouter.delete('/:livestockId', authenticateJWT, deleteLivestock);