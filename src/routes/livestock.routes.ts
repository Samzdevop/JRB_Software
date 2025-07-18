import { Router } from 'express';
import {
  addLivestock,
  getLivestock,
  updateLivestock,
  deleteLivestock,
  getAllLivestock,
  getLivestockCounts,
  softDeleteLivestock,
  getDeletedLivestock,
  restoreLivestock,
} from '../contollers/livestock.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import {
  addLivestockSchema,
  deleteLivestockSchema,
  updateLivestockSchema,
} from '../schemas/livestock.schemas';
import { requireRoles } from '../middlewares/roleCheck';

export const livestockRouter = Router();

livestockRouter.post(
  '/',
  authenticateJWT,
  validateRequest(addLivestockSchema),
  addLivestock
);

livestockRouter.get(
  '/counts',
  authenticateJWT,
  getLivestockCounts
)

livestockRouter.get(
  '/',
  authenticateJWT, 
  getAllLivestock
);

livestockRouter.get(
  '/:livestockId', 
  authenticateJWT, 
  getLivestock
);

livestockRouter.patch(
  '/:livestockId',
  authenticateJWT,
  validateRequest(updateLivestockSchema),
  updateLivestock
);

// permanent delete livestock
livestockRouter.delete(
  '/:livestockId', 
  requireRoles(['ADMIN', 'FARM_KEEPER']),
  authenticateJWT, 
  deleteLivestock
);

// softdelete livestock 
livestockRouter.delete(
  '/:livestockId/soft-delete',
  authenticateJWT,
  validateRequest(deleteLivestockSchema),
  softDeleteLivestock
);

// Admin-only routes
livestockRouter.get(
  '/deleted/all',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getDeletedLivestock
);

livestockRouter.patch(
  '/:livestockId/restore',
  authenticateJWT,
  requireRoles(['ADMIN']),
  restoreLivestock
);

