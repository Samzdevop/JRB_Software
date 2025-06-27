import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
// import { Prisma } from '@prisma/client';

export const getProfile = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: (req.user as any).id },
		});

		if (!user) throw new NotFoundError('User not found');

		user.password = '';
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
		const user = await prisma.user.findUnique({
			where: { id: (req.user as any).id },
		});

		if (!user) throw new NotFoundError('User not found');

		const update = req.body;

		await prisma.user.update({
			where: { email: user.email },
			data: update,
		});

		sendSuccessResponse(res, 'Profile successfully updated');
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

export const deleteUser = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = await prisma.user.delete({ where: { id: req.params.userId } });
		console.log({ user });
		res.status(204).end();
	} catch (error) {
		next(error);
	}
};