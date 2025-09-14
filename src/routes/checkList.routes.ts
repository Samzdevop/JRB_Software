// routes/checklist.routes.ts
import { Router } from 'express';
import {
  addToChecklist,
  getChecklist,
  updateChecklistItem,
  deleteChecklistItem,
} from '../contollers/checkList.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import {
  addToChecklistSchema,
  updateChecklistSchema,
} from '../schemas/document.schemas';

export const checklistRouter = Router();

checklistRouter.post(
  '/:documentId',
  authenticateJWT,
  validateRequest(addToChecklistSchema),
  addToChecklist
);

checklistRouter.get(
  '/:documentId',
  authenticateJWT,
  getChecklist
);

checklistRouter.patch(
  '/:checklistId',
  authenticateJWT,
  validateRequest(updateChecklistSchema),
  updateChecklistItem
);

checklistRouter.delete(
  '/:checklistId',
  authenticateJWT,
  deleteChecklistItem
);