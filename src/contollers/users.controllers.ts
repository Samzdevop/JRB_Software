import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { userSelect } from '../prisma/selects';
import { ForbiddenError } from '../errors/ForbiddenError';
import { Role } from '@prisma/client';
// import { Prisma } from '@prisma/client';

export const getProfile = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: (req.user as any).id },
			select: userSelect 
		});

		if (!user) throw new NotFoundError('User not found');

		// user.password = '';
		sendSuccessResponse(res, 'Profile successfully retrieved', user);
	} catch (error) {
		next(error);
	}
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { fullName, location, avatar, phone } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { fullName, location, avatar, phone },
      select: userSelect
    });

    sendSuccessResponse(res, 'Profile updated successfully', updatedUser);
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const requestingUser = (req as any).user; // Get the current user
    const { page = 1, limit = 10 } = req.query;

    // Determine which roles the current user can access
    let allowedRoles: Role[] = [];
    
    if (requestingUser.role === 'ADMIN') {
      allowedRoles = ['FARM_KEEPER', 'COWORKER'];
    } else if (requestingUser.role === 'FARM_KEEPER') {
      allowedRoles = ['COWORKER'];
    } else {
      throw new ForbiddenError('You do not have permission to view users');
    }

    const where = {
      role: { in: allowedRoles },
      id: { not: requestingUser.id } // Exclude the current user
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: userSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where })
    ]);

    sendSuccessResponse(res, 'Users retrieved successfully', {
      users,
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


export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: userSelect
    });

    if (!user) throw new NotFoundError('User not found');
    sendSuccessResponse(res, 'User retrieved successfully', user);
  } catch (error) {
    next(error);
  }
};


export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
	const user = await prisma.user.findUnique({
		where: {id: req.params.userId}
	});
	
	if (!user) throw new NotFoundError('User not found');

    await prisma.user.delete({
      where: { id: req.params.userId },
    });

    sendSuccessResponse(res, 'User permanently deleted successfully');
  } catch (error) {
    next(error);
  }
};