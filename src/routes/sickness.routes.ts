import { Router } from 'express';
import { getAllSickness, getSicknessById, reportSickness } from '../contollers/sickness.controllers';
import { authenticateJWT } from '../middlewares/errorHandler';
import { requireRoles } from '../middlewares/roleCheck';
import { validateRequest } from '../middlewares/validateRequest';
import { reportSicknessSchema } from '../schemas/sickness.schemas';

export const sicknessRouter = Router();


sicknessRouter.get(
  '/',
  authenticateJWT,
  getAllSickness
);

sicknessRouter.get(
  '/:sicknessId',
  authenticateJWT,
  getSicknessById
);

sicknessRouter.post(
  '/livestock/:livestockId',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER', 'COWORKER', 'VET']),
  validateRequest(reportSicknessSchema),
  reportSickness
);