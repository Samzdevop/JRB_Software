import { Router } from 'express';
import {
	deleteUser,
	getAllUsers,
	getProfile,
	getUserById,
	updateProfile,
} from '../contollers/users.controllers';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { updateUserSchema } from '../schemas/users.schemas';

export const usersRouter = Router();

usersRouter.get(
	'/profile', 
	authenticateJWT, 
	getProfile
);

usersRouter.patch(
	'/update',
	authenticateJWT,
	validateRequest(updateUserSchema),
	updateProfile
);

// Admin user management routes 
usersRouter.get(
	'/', 
	authenticateJWT,
	getAllUsers
);

usersRouter.get(
	'/:userId',
	authenticateJWT,
	getUserById
);

usersRouter.delete(
	'/:userId', 
	authenticateJWT,
	// requireRoles(['ADMIN', 'FARM_KEEPER']),
	deleteUser
);



