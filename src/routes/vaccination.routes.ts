import { Router } from 'express';
import {
  recordVaccination,
  getVaccination,
  getLivestockVaccinations,
  getAllVaccinations,
  updateVaccination,
  deleteVaccination,
} from '../contollers/vaccination.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { requireRoles } from '../middlewares/roleCheck';
import { validateRequest } from '../middlewares/validateRequest';
import { updatevaccinationSchema, vaccinationSchema } from '../schemas/vaccination.schemas';

export const vaccinationRouter = Router();

// Record new vaccination for specific livestock
vaccinationRouter.post(
  '/livestock/:livestockId/vaccinations',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER', 'VET']),
  validateRequest(vaccinationSchema),
  recordVaccination
);

// Get specific vaccination record
vaccinationRouter.get(
  '/vaccinations/:vaccinationId',
  authenticateJWT,
  getVaccination
);

// Get all vaccinations for specific livestock
vaccinationRouter.get(
  '/livestock/:livestockId/vaccinations',
  authenticateJWT,
  getLivestockVaccinations
);

// Get all vaccinations (with optional livestock filter)
vaccinationRouter.get(
  '/vaccinations',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER']),
  getAllVaccinations
);

// Update vaccination record
vaccinationRouter.patch(
  '/vaccinations/:vaccinationId',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER', 'VET']),
  validateRequest(updatevaccinationSchema),
  updateVaccination
);

// Delete vaccination record
vaccinationRouter.delete(
  '/vaccinations/:vaccinationId',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER']),
  deleteVaccination
);