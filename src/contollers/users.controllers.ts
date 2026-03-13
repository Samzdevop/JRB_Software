import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { userSelect } from '../prisma/selects';
import { BadRequestError } from '../errors/BadRequestError';
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

export const uploadAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('=== STARTING AVATAR UPLOAD ===');

    if (!req.file) {
      return next(new BadRequestError('No image file uploaded'));
    }

    const userId = (req.user as any).id;
    const avatarPath = `/uploads/${req.file.filename}`;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarPath },
      select: userSelect,
    });

    sendSuccessResponse(res, 'Avatar uploaded successfully', { user: updatedUser }, 200);
  } catch (error) {
    console.error('Avatar upload error:', error);
    next(error);
  }
};

export const deleteAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('=== STARTING AVATAR DELETION ===');
    
    const userId = (req.user as any).id;

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect
    });

    if (!currentUser) {
      throw new NotFoundError('User not found');
    }

    if (!currentUser.avatar) {
      throw new BadRequestError('User has no avatar to delete');
    }

    // Remove avatar from user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: userSelect
    });

    console.log('Avatar deleted successfully for user:', userId);

    sendSuccessResponse(
      res,
      'Avatar deleted successfully',
      { user: updatedUser },
      200
    );

  } catch (error) {
    console.error('Avatar deletion error:', error);
    next(error);
  }
};

export const getAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.avatar) {
      throw new NotFoundError('User has no avatar');
    }

    sendSuccessResponse(res, 'Avatar retrieved', {
      avatar: user.avatar
    });

  } catch (error) {
    console.error('Error getting avatar:', error);
    next(error);
  }
};

export const getMyAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any).id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.avatar) {
      throw new NotFoundError('You have no avatar');
    }

    sendSuccessResponse(res, 'Avatar retrieved', {
      avatar: user.avatar
    });

  } catch (error) {
    console.error('Error getting avatar:', error);
    next(error);
  }
};


 