"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notesRouter = void 0;
const express_1 = require("express");
const notes_controller_1 = require("../contollers/notes.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const document_schemas_1 = require("../schemas/document.schemas");
exports.notesRouter = (0, express_1.Router)();
exports.notesRouter.post('/:documentId', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(document_schemas_1.createNoteSchema), notes_controller_1.createNote);
exports.notesRouter.get('/:noteId', errorHandler_1.authenticateJWT, notes_controller_1.getNoteById);
exports.notesRouter.get('/', errorHandler_1.authenticateJWT, notes_controller_1.getNotes);
exports.notesRouter.patch('/:noteId', errorHandler_1.authenticateJWT, notes_controller_1.updateNote);
exports.notesRouter.delete('/:noteId', errorHandler_1.authenticateJWT, notes_controller_1.deleteNote);
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
