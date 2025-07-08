import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';

export const createOfftake = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, dateOfEvent, destination, price, causeOfDeath, notes } = req.body;
    const livestockId = req.params.livestockId;
    const recordedById = (req.user as any).id;

    const livestock = await prisma.livestock.findUnique({ where: { id: livestockId } });
    if (!livestock) throw new NotFoundError('Livestock not found');

    const offtake = await prisma.offtakeRecord.create({
      data: {
        livestockId,
        type,
        dateOfEvent: new Date(dateOfEvent),
        destination: type === 'SALE' ? destination : null,
        price: type === 'SALE' ? price : null,
        causeOfDeath: type === 'DEATH' ? causeOfDeath : null,
        notes,
        recordedById
      },
      include: {
        livestock: true,
        recordedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    sendSuccessResponse(res, 'Offtake recorded', { offtake }, 201);
  } catch (error) {
    next(error);
  }
};

export const getLivestockOfftakes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const livestockId = req.params.livestockId;

    const [offtakes, total] = await Promise.all([
      prisma.offtakeRecord.findMany({
        where: { livestockId },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { dateOfEvent: 'desc' },
        include: { livestock: true },
      }),
      prisma.offtakeRecord.count({ where: { livestockId } })
    ]);

    sendSuccessResponse(res, 'Offtakes retrieved', {
      offtakes,
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

export const getAllOfftakes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, type } = req.query;

    const where = type ? { type: type as 'SALE' | 'DEATH' | 'MISSING' } : {};
    
    const [offtakes, total] = await Promise.all([
      prisma.offtakeRecord.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { dateOfEvent: 'desc' },
        include: { livestock: true },
      }),
      prisma.offtakeRecord.count({ where })
    ]);

    sendSuccessResponse(res, 'All offtakes', {
      offtakes,
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