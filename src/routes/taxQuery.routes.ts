import { Router } from 'express';
import {
  queryNigeriaTaxAct,
  getTaxQueryHistory,
  getTaxQueryResult,
  uploadAndQueryTaxDocument,
} from '../contollers/taxQuery.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { taxQuerySchema } from '../schemas/taxQuery.schemas';
import { comparisonUpload } from '../config/multer';


const uploadMiddleware = comparisonUpload.single('document');

export const taxQueryRouter = Router();


taxQueryRouter.post(
  '/answer-upload',
  authenticateJWT,
  uploadMiddleware,
  uploadAndQueryTaxDocument
);

taxQueryRouter.post(
  '/',
  authenticateJWT,
  validateRequest(taxQuerySchema),
  queryNigeriaTaxAct
);


taxQueryRouter.get(
  '/history',
  authenticateJWT,
  getTaxQueryHistory
);


taxQueryRouter.get(
  '/:queryId',
  authenticateJWT,
  getTaxQueryResult
);

