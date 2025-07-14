import { Router } from 'express';
import { 
  createTask, 
  getMyTasks, 
  getTask, 
  updateTaskStatus 
} from '../contollers/task.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { requireRoles } from '../middlewares/roleCheck';
import { validateRequest } from '../middlewares/validateRequest';
import { createTaskSchema, updateTaskStatusSchema } from '../schemas/task.schemas';

const router = Router();

router.post(
  '/',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER']),
  validateRequest(createTaskSchema),
  createTask
);

router.get(
  '/my-tasks',
  authenticateJWT,
  getMyTasks
);

router.get(
  '/:taskId',
  authenticateJWT,
  getTask
);

router.patch(
  '/:taskId/status',
  authenticateJWT,
  validateRequest(updateTaskStatusSchema),
  updateTaskStatus
);

export const taskRouter = router;