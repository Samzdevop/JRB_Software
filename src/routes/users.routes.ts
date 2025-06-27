import { Router } from 'express';
import {
	deleteUser,
	getAllUsers,
	getProfile,
	updateProfile,
} from '../contollers/users.controllers';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { updateUserSchema } from '../schemas/users.schemas';

export const usersRouter = Router();

usersRouter.get('/profile', authenticateJWT, getProfile);

usersRouter.patch(
	'/update',
	authenticateJWT,
	validateRequest(updateUserSchema),
	updateProfile
);

usersRouter.get('/', getAllUsers);

usersRouter.delete('/:userId', deleteUser);