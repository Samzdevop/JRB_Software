import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { userSelect } from '../prisma/selects';

export const recordVaccination = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dateofVaccination, vaccineType, dosage, administeredBy, nextDueDate } = req.body;
    const livestockId = req.params.livestockId;
    const recordedById = (req.user as any).id;

    const livestock = await prisma.livestock.findUnique({
      where: { id: livestockId }
    });
    if (!livestock) throw new NotFoundError('Livestock not found');

    const vaccination = await prisma.vaccination.create({
      data: {
        livestockId,
        dateofVaccination: new Date(dateofVaccination),
        vaccineType,
        dosage: parseFloat(dosage),
        administeredBy,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        recordedById
      },
      include: {
        livestock: true,
        recordedBy: { select: userSelect },
      },
    });

    sendSuccessResponse(
      res,
      'Vaccination successfully recorded',
      { vaccination },
      201
    );
  } catch (error) {
    next(error);
  }
};

//Get vaccination by vaccinationId
export const getVaccination = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vaccination = await prisma.vaccination.findUnique({
      where: { id: req.params.vaccinationId },
      include: {
        livestock: true,
        recordedBy: { select: userSelect },
      },
    });

    if (!vaccination) throw new NotFoundError('Vaccination record not found');
    sendSuccessResponse(res, 'Vaccination retrieved successfully', { vaccination });
  } catch (error) {
    next(error);
  }
};

// Get all vaccinations for specific livestock
export const getLivestockVaccinations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const vaccinations = await prisma.vaccination.findMany({
      where: { livestockId: req.params.livestockId },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: {
        livestock: true,
        recordedBy: { select: userSelect },
      },
      orderBy: { dateofVaccination: 'desc' },
    });

    const total = await prisma.vaccination.count({ 
      where: { livestockId: req.params.livestockId }
    });

    sendSuccessResponse(res, 'Livestock vaccinations retrieved successfully', {
      vaccinations,
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

// Get all vaccinations with optional livestock filter
export const getAllVaccinations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, livestockId } = req.query;
    
    const where = {
      ...(livestockId && { livestockId: String(livestockId) }),
    };

    const vaccinations = await prisma.vaccination.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: {
        livestock: true,
        recordedBy: { select: userSelect },
      },
      orderBy: { dateofVaccination: 'desc' },
    });

    const total = await prisma.vaccination.count({ where });

    sendSuccessResponse(res, 'Vaccination records retrieved successfully', {
      vaccinations,
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

export const updateVaccination = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dateofVaccination, vaccineType, dosage, administeredBy, nextDueDate } = req.body;
    const requestingUser = (req.user as any);

    const existingRecord = await prisma.vaccination.findUnique({
      where: { id: req.params.vaccinationId },
      // include: { recordedBy: true }
    });

    if (!existingRecord) throw new NotFoundError('Vaccination record not found');

    // Check permissions
    const isOwner = existingRecord.recordedById === requestingUser.id;
    const isPrivileged = ['ADMIN', 'FARM_KEEPER'].includes(requestingUser.role);
    
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenError('You do not have permission to update this record');
    }

    const vaccination = await prisma.vaccination.update({
      where: { id: req.params.vaccinationId },
      data: {
        dateofVaccination: dateofVaccination ? new Date(dateofVaccination) : undefined,
        vaccineType,
        dosage: dosage ? parseFloat(dosage) : undefined,
        administeredBy,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      },
      include: {
        livestock: true,
        recordedBy: { select: userSelect },
      },
    });

    sendSuccessResponse(res, 'Vaccination updated successfully', { vaccination });
  } catch (error) {
    next(error);
  }
};

export const deleteVaccination = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requestingUser = (req.user as any);

    const existingRecord = await prisma.vaccination.findUnique({
      where: { id: req.params.vaccinationId },
      include: { recordedBy: true }
    });

    if (!existingRecord) throw new NotFoundError('Vaccination record not found');

    // Check permissions
    const isOwner = existingRecord.recordedById === requestingUser.id;
    const isPrivileged = ['ADMIN', 'FARM_KEEPER'].includes(requestingUser.role);
    
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenError('You do not have permission to delete this record');
    }

    await prisma.vaccination.delete({
      where: { id: req.params.vaccinationId },
    });

    sendSuccessResponse(res, 'Vaccination record deleted successfully');
  } catch (error) {
    next(error);
  }
};