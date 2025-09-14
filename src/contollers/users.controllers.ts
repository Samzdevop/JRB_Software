import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { userSelect } from '../prisma/selects';
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
    const { fullName, location, company, jobTitle, avatar } = req.body;



    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { fullName, location, company, jobTitle, avatar},
      select: userSelect
    });

    sendSuccessResponse(res, 'Profile updated successfully', updatedUser);
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (
	_req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const users = await prisma.user.findMany({
			orderBy: { createdAt: 'desc' },
		});

		res.status(200).json({ data: users });
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
 