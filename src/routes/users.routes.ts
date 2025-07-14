import { Router } from 'express';
import {
	deleteUser,
	getAllUsers,
	getProfile,
	updateProfile,
	getUserById,
	getAssignableUsers
} from '../contollers/users.controllers';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { updateUserSchema } from '../schemas/users.schemas';
import { requireRoles } from '../middlewares/roleCheck';

export const usersRouter = Router();

usersRouter.get('/profile', authenticateJWT, getProfile);

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
	requireRoles(['ADMIN', 'FARM_KEEPER']),
	getAllUsers
);

usersRouter.get(
	'/:userId',
	authenticateJWT,
	requireRoles(['AMDIN', 'FARM_KEEPER']),
	getUserById
);

usersRouter.delete(
	'/:userId', 
	authenticateJWT,
	requireRoles(['ADMIN', 'FARM_KEEPER']),
	deleteUser
);

usersRouter.get(
  '/assignable',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER']),
  getAssignableUsers
);
