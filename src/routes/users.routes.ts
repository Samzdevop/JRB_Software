import { Router } from 'express';
import {
	deleteAvatar,
	deleteUser,
	getAllUsers,
	getAvatar,
	getMyAvatar,
	getProfile,
	getUserById,
	updateProfile,
	uploadAvatar,
} from '../contollers/users.controllers';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { updateUserSchema, uploadAvatarSchema } from '../schemas/users.schemas';
import { avatarUpload } from '../config/multer';

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


usersRouter.post(
  '/avatar',
  authenticateJWT,
  avatarUpload.single('avatar'),
  uploadAvatar
);

usersRouter.delete(
  '/avatar',
  authenticateJWT,
  deleteAvatar
);

usersRouter.get(
  '/avatar/me',
  authenticateJWT,
  getMyAvatar
);

usersRouter.get(
  '/avatar/:userId',
  authenticateJWT,
  getAvatar
);

