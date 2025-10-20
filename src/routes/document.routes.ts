import { Router } from 'express';
import {
  uploadDocument,
  searchDocument,
  getSearchHistory,
  getDocuments,
  getDocumentStatus,
  deleteDocument,
  getDocumentContent,
  getDocumentTableOfContents,
} from '../contollers/document.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import {
  uploadDocumentSchema,
  searchDocumentSchema,
} from '../schemas/document.schemas';
import { upload } from '../config/multer';

const uploadMiddleware = upload.single('document');

export const documentRouter = Router();

documentRouter.post(
  '/upload',
  authenticateJWT,
  uploadMiddleware,
  validateRequest(uploadDocumentSchema),
  uploadDocument
);

documentRouter.post(
  '/:documentId/search',
  authenticateJWT,
  validateRequest(searchDocumentSchema),
  searchDocument
);

documentRouter.get(
  '/search-history',
  authenticateJWT,
  getSearchHistory
);

documentRouter.get(
  '/',
  authenticateJWT,
  getDocuments
);

documentRouter.get(
  '/:documentId/status',
  authenticateJWT,
  getDocumentStatus
);


documentRouter.delete(
  '/:documentId',
  authenticateJWT,
  deleteDocument
);

documentRouter.get(
  '/:documentId/content',
  authenticateJWT,
  getDocumentContent
);

documentRouter.get(
  '/:documentId/toc',
  authenticateJWT,
  getDocumentTableOfContents
);