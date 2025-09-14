import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { BadRequestError } from '../errors/BadRequestError';

export const addToChecklist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { item } = req.body;
    const { documentId } = req.params;
    const userId = (req.user as any).id;

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const checklist = await prisma.checklist.create({
      data: {
        item,
        documentId,
        userId,
      },
      include: {
        document: {
          select: { id: true, title: true }
        }
      }
    });

    sendSuccessResponse(res, 'Item added to checklist', { checklist }, 201);
  } catch (error) {
    next(error);
  }
};

export const getChecklist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const userId = (req.user as any).id;
    const { completed } = req.query;

    const where = { 
      userId, 
      ...(documentId && { documentId: String(documentId) }),
      ...(completed !== undefined && { completed: completed === 'true' })
    };

    const checklist = await prisma.checklist.findMany({
      where,
      include: {
        document: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccessResponse(res, 'Checklist retrieved', { checklist });
  } catch (error) {
    next(error);
  }
};

export const updateChecklistItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checklistId } = req.params;
    const { completed } = req.body;

    const checklist = await prisma.checklist.update({
      where: { id: checklistId },
      data: { completed },
      include: {
        document: {
          select: { id: true, title: true }
        }
      }
    });

    sendSuccessResponse(res, 'Checklist item updated', { checklist });
  } catch (error) {
    next(error);
  }
};

export const deleteChecklistItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checklistId } = req.params;
    const userId = (req.user as any).id;

    // Verify the checklist item belongs to the user
    const checklistItem = await prisma.checklist.findFirst({
      where: { id: checklistId, userId },
    });

    if (!checklistItem) {
      throw new NotFoundError('Checklist item not found');
    }

    await prisma.checklist.delete({
      where: { id: checklistId },
    });

    sendSuccessResponse(res, 'Checklist item deleted successfully');
  } catch (error) {
    next(error);
  }
};