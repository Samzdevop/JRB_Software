import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { userSelect } from '../prisma/selects';

export const addLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      tagId, 
      type, 
      breed, 
      birthDate, 
      healthStatus,
      weight,
      gender,
      livestockSource,
      livestockPurpose
    } = req.body;
    
    const addedById = (req.user as any).id;

    const livestock = await prisma.livestock.create({
      data: {
        tagId,
        type,
        breed,
        birthDate: birthDate ? new Date(birthDate) : null,
        healthStatus,
        weight: weight ? parseFloat(weight) : null,
        gender,
        livestockSource,
        livestockPurpose,
        addedById,
      },
      include: {
        addedBy: { select: userSelect}, // Include the user who added the livestock
      },
    });

    sendSuccessResponse(
      res,
      'Livestock successfully added',
      { livestock },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const livestock = await prisma.livestock.findUnique({
      where: { 
        id: req.params.livestockId,
      },
      include: { 
        addedBy: {select: userSelect},
        updatedBy: {select: userSelect}
      },
    });

    if (!livestock) throw new NotFoundError('Livestock not found');
    sendSuccessResponse(res, 'Livestock retrieved successfully', { livestock });
  } catch (error) {
    next(error);
  }
};

export const getAllLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const where = { 
      ...(type && { type: String(type) }) 
    };

    const livestock = await prisma.livestock.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { addedBy: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.livestock.count({ where });

    sendSuccessResponse(res, 'Livestock retrieved successfully', { 
      livestock,
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

export const updateLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      tagId, 
      type, 
      breed, 
      birthDate, 
      healthStatus,
      weight,
      gender,
      livestockSource,
      livestockPurpose
    } = req.body;

    const updatedById = (req.user as any).id; // Get current user ID from JWT

    const livestock = await prisma.livestock.update({
      where: { 
        id: req.params.livestockId,
      },
      data: {
        tagId,
        type,
        breed,
        birthDate: birthDate ? new Date(birthDate) : null,
        healthStatus,
        weight: weight ? parseFloat(weight) : null,
        gender,
        livestockSource,
        livestockPurpose,
        updatedById 
      },
      include: {
        addedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          }
        },    
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          }
        } 
      }
    });

    if (!livestock) throw new NotFoundError('Livestock not found');

    sendSuccessResponse(res, 'Livestock updated successfully', { livestock });
  } catch (error) {
    next(error);
  }
};


export const deleteLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const livestock = await prisma.livestock.findUnique({
      where: { id: req.params.livestockId },
    });

    if (!livestock) throw new NotFoundError('Livestock not found');

    await prisma.livestock.delete({
      where: { id: req.params.livestockId, },
    });
    sendSuccessResponse(res, 'Livestock deleted successfully!', { livestock });
  } catch (error) {
    next(error);
  }
};
