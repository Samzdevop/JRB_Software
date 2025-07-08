import { Router } from 'express';
import { getAllTreatments, getTreatmentById, recordTreatment } from '../contollers/treatment.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { requireRoles } from '../middlewares/roleCheck';
import { validateRequest } from '../middlewares/validateRequest';
import { recordTreatmentSchema } from '../schemas/treatment.schemas';

export const treatmentRouter = Router();

treatmentRouter.get(
  '/',
  authenticateJWT,
  getAllTreatments
);

treatmentRouter.get(
  '/:treatmentId',
  authenticateJWT,
  getTreatmentById
);

treatmentRouter.post(
  '/livestock/:livestockId',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER', 'COWORKER', 'VET']),
  validateRequest(recordTreatmentSchema),
  recordTreatment
);

// route for treatment linked to specific sickness
// treatmentRouter.post(
//   '/livestock/:livestockId/sickness/:sicknessId/treatment',
//   authenticateJWT,
//   requireRoles(['ADMIN', 'FARM_KEEPER', 'VET']),
//   validateRequest(recordTreatmentSchema),
//   recordTreatment
// );