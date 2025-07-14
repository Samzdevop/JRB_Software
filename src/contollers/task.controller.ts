import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { BadRequestError } from '../errors/BadRequestError';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { userSelect } from '../prisma/selects';
import { TaskStatus } from '@prisma/client';

export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description, priority, dueDate, assignedToId } = req.body;
    const assignedById = (req.user as any).id;
    const assignedByRole = (req.user as any).role;

    // Check if assignee exists
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { role: true }
    });

    if (!assignee) {
      throw new NotFoundError('Assignee not found');
    }

    // Validate assignment permissions
    if (assignedByRole === 'FARM_KEEPER' && assignee.role !== 'COWORKER') {
      throw new ForbiddenError('Farm keepers can only assign tasks to coworkers');
    }

    if (assignedByRole === 'ADMIN' && !['FARM_KEEPER', 'COWORKER'].includes(assignee.role)) {
      throw new ForbiddenError('Admins can only assign tasks to farm keepers or coworkers');
    }

    const task = await prisma.task.create({
      data: {
        name,
        description,
        priority,
        dueDate: new Date(dueDate),
        status: 'PENDING',
        assignedToId,
        assignedById
      },
      include: {
        assignedTo: { select: userSelect },
        assignedBy: { select: userSelect }
      }
    });

    sendSuccessResponse(res, 'Task created successfully', { task }, 201);
  } catch (error) {
    next(error);
  }
};

export const getMyTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { status, page = 1, limit = 10 } = req.query;

    const where = {
      assignedToId: userId, // This ensures users only see their own tasks
      ...(status && { status: status as TaskStatus }) // Cast to 'any' or use the correct enum type if available
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: {
          assignedBy: { 
            select: {
              id: true,
              fullName: true,
              role: true
            } 
          }
        }
      }),
      prisma.task.count({ where })
    ]);

    sendSuccessResponse(res, 'Tasks retrieved successfully', {
      tasks,
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

export const getTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const taskId = req.params.taskId;

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        assignedToId: userId // Ensures the task belongs to the user
      },
      include: {
        assignedBy: {select: userSelect } 
        }
    });

    if (!task) {
      throw new NotFoundError('Task not found or you do not have permission to view it');
    }

    sendSuccessResponse(res, 'Task retrieved successfully', { task });
  } catch (error) {
    next(error);
  }
};

export const updateTaskStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.body;
    const taskId = req.params.taskId;
    const userId = (req.user as any).id;

    // Verify task exists and belongs to user
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (task.assignedToId !== userId) {
      throw new ForbiddenError('You can only update your own tasks');
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status },
      include: {
        assignedTo: { select: userSelect },
        assignedBy: { select: userSelect }
      }
    });

    sendSuccessResponse(res, 'Task status updated successfully', { task: updatedTask });
  } catch (error) {
    next(error);
  }
};