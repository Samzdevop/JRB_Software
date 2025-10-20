import { Router } from 'express';
import {
  createNote,
  getNotes,
  updateNote,
  deleteNote,
  getNoteById,
  // getNotesByDocument,
} from '../contollers/notes.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createNoteSchema,
} from '../schemas/document.schemas';

export const notesRouter = Router();

notesRouter.post(
  '/:documentId',
  authenticateJWT,
  validateRequest(createNoteSchema),
  createNote
);

notesRouter.get(
  '/:noteId',
  authenticateJWT,
  getNoteById
);
notesRouter.get(
  '/',
  authenticateJWT,
  getNotes
);

notesRouter.patch(
  '/:noteId',
  authenticateJWT,
  updateNote
);

notesRouter.delete(
  '/:noteId',
  authenticateJWT,
  deleteNote
);


// Get all notes for a specific document
// notesRouter.get(
//   '/documents/:documentId/notes',
//   authenticateJWT, 
//   getNotesByDocument
// );

// Create a note for a specific document
// notesRouter.post(
//   '/documents/:documentId/notes',
//   authenticateJWT,
//   validateRequest(createNoteSchema),
//   createNote
// );
