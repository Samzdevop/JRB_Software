import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { BadRequestError } from '../errors/BadRequestError';

export const createNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { body } = req.body;
    const { documentId } = req.params;
    const userId = (req.user as any).id;

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const note = await prisma.note.create({
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

    sendSuccessResponse(res, 'Note created successfully', { note }, 201);
  } catch (error) {
    next(error);
  }
};

export const getNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const userId = (req.user as any).id;
    const { page = 1, limit = 10 } = req.query;

    const where = { userId, ...(documentId && { documentId: String(documentId) }) };

    const notes = await prisma.note.findMany({
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

    const total = await prisma.note.count({ where });

    sendSuccessResponse(res, 'Notes retrieved', {
      notes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getNoteById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { noteId } = req.params;

    const note = await prisma.note.findUnique({
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
      throw new NotFoundError('Note not found');
    }

    sendSuccessResponse(res, 'Note retrieved', { note });
  } catch (error) {
    next(error);
  }
};


export const updateNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { noteId } = req.params;
    const { body } = req.body;
    const userId = (req.user as any).id;

    // Verify the note belongs to the user
    const note = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundError('Note not found');
    }

    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: { body },
      include: {
        document: {
          select: { id: true, title: true }
        }
      }
    });

    sendSuccessResponse(res, 'Note updated successfully', { note: updatedNote });
  } catch (error) {
    next(error);
  }
};

export const deleteNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { noteId } = req.params;
    const userId = (req.user as any).id;

    // Verify the note belongs to the user
    const note = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundError('Note not found');
    }

    await prisma.note.delete({
      where: { id: noteId },
    });

    sendSuccessResponse(res, 'Note deleted successfully');
  } catch (error) {
    next(error);
  }
};


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
