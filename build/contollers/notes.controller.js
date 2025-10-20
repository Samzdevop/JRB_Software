"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNote = exports.updateNote = exports.getNoteById = exports.getNotes = exports.createNote = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const createNote = async (req, res, next) => {
    try {
        const { body } = req.body;
        const { documentId } = req.params;
        const userId = req.user.id;
        // Verify document exists
        const document = await prisma_1.default.document.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new NotFoundError_1.NotFoundError('Document not found');
        }
        const note = await prisma_1.default.note.create({
            data: {
                body,
                documentId,
                userId,
            },
            include: {
                document: {
                    select: { id: true, title: true }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Note created successfully', { note }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createNote = createNote;
const getNotes = async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        const where = { userId, ...(documentId && { documentId: String(documentId) }) };
        const notes = await prisma_1.default.note.findMany({
            where,
            include: {
                document: {
                    select: { id: true, title: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
        });
        const total = await prisma_1.default.note.count({ where });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Notes retrieved', {
            notes,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotes = getNotes;
const getNoteById = async (req, res, next) => {
    try {
        const { noteId } = req.params;
        const note = await prisma_1.default.note.findUnique({
            where: { id: noteId },
            include: {
                document: {
                    select: { id: true, title: true }
                },
                user: {
                    select: { id: true, fullName: true }
                }
            }
        });
        if (!note) {
            throw new NotFoundError_1.NotFoundError('Note not found');
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Note retrieved', { note });
    }
    catch (error) {
        next(error);
    }
};
exports.getNoteById = getNoteById;
const updateNote = async (req, res, next) => {
    try {
        const { noteId } = req.params;
        const { body } = req.body;
        const userId = req.user.id;
        // Verify the note belongs to the user
        const note = await prisma_1.default.note.findFirst({
            where: { id: noteId, userId },
        });
        if (!note) {
            throw new NotFoundError_1.NotFoundError('Note not found');
        }
        const updatedNote = await prisma_1.default.note.update({
            where: { id: noteId },
            data: { body },
            include: {
                document: {
                    select: { id: true, title: true }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Note updated successfully', { note: updatedNote });
    }
    catch (error) {
        next(error);
    }
};
exports.updateNote = updateNote;
const deleteNote = async (req, res, next) => {
    try {
        const { noteId } = req.params;
        const userId = req.user.id;
        // Verify the note belongs to the user
        const note = await prisma_1.default.note.findFirst({
            where: { id: noteId, userId },
        });
        if (!note) {
            throw new NotFoundError_1.NotFoundError('Note not found');
        }
        await prisma_1.default.note.delete({
            where: { id: noteId },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Note deleted successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteNote = deleteNote;
// Get all notes for a specific document
// export const getNotesByDocument = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { documentId } = req.params;
//     const { page = 1, limit = 10 } = req.query;
//     // Verify document exists
//     const document = await prisma.document.findUnique({
//       where: { id: documentId },
//     });
//     if (!document) {
//       throw new NotFoundError('Document not found');
//     }
//     const where = { documentId };
//     const notes = await prisma.note.findMany({
//       where,
//       include: {
//         document: {
//           select: { id: true, title: true }
//         },
//         user: {
//           select: { id: true, fullName: true }
//         }
//       },
//       orderBy: { createdAt: 'desc' },
//       skip: (Number(page) - 1) * Number(limit),
//       take: Number(limit),
//     });
//     const total = await prisma.note.count({ where });
//     sendSuccessResponse(res, 'Notes retrieved', {
//       notes,
//       pagination: {
//         page: Number(page),
//         limit: Number(limit),
//         total,
//         pages: Math.ceil(total / Number(limit))
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };
