import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { userSelect } from '../prisma/selects';

export const recordTreatment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dateOfTreatment, treatmentType, dosage, cause, administeredBy, nextDueDate } = req.body;
    const livestockId = req.params.livestockId;
    const sicknessId = req.params.sicknessId; // Optional
    const recordedById = (req.user as any).id;

    // Verify livestock exists
    const livestock = await prisma.livestock.findUnique({
      where: { id: livestockId }
    });
    if (!livestock) throw new NotFoundError('Livestock not found');

    // Verify sickness exists if provided
    if (sicknessId) {
      const sickness = await prisma.sickness.findUnique({
        where: { id: sicknessId }
      });
      if (!sickness) throw new NotFoundError('Sickness record not found');
    }

    // Create treatment and update livestock status in a transaction
    const [treatment] = await prisma.$transaction([
      prisma.treatment.create({
        data: {
          livestockId,
          sicknessId,
          dateOfTreatment: new Date(dateOfTreatment),
          treatmentType,
          dosage,
          cause,
          administeredBy,
          nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
          recordedById,
        },
        include: {
          livestock: true,
          sickness: true,
          recordedBy: { select: userSelect },
        },
      }),
      prisma.livestock.update({
        where: { id: livestockId },
        data: { 
          isTreatment: true,
          healthStatus: 'IN_TREATMENT'
        },
      }),
    ]);

    sendSuccessResponse(
      res,
      'Treatment successfully recorded',
      { treatment },
      201
    );
  } catch (error) {
    next(error);
  }
};


// Get all treatments
export const getAllTreatments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, livestockId, sicknessId } = req.query;
    
    const where = {
      ...(livestockId && { livestockId: String(livestockId) }),
      ...(sicknessId && { sicknessId: String(sicknessId) })
    };

    const treatments = await prisma.treatment.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: {
        livestock: true,
        sickness: true,
        recordedBy: { select: userSelect }
      },
      orderBy: { dateOfTreatment: 'desc' }
    });

    const total = await prisma.treatment.count({ where });

    sendSuccessResponse(res, 'Treatments retrieved', {
      treatments,
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

// Get single treatment
export const getTreatmentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const treatment = await prisma.treatment.findUnique({
      where: { id: req.params.treatmentId },
      include: {
        livestock: true,
        sickness: true,
        recordedBy: { select: userSelect }
      }
    });

    if (!treatment) throw new NotFoundError('Treatment record not found');
    sendSuccessResponse(res, 'Treatment retrieved', { treatment });
  } catch (error) {
    next(error);
  }
};