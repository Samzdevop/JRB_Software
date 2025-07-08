// routes/offtake.routes.ts
import { Router } from 'express';
import { 
  createOfftake,
  getLivestockOfftakes,
  getAllOfftakes
} from '../contollers/offtake.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { requireRoles } from '../middlewares/roleCheck';
import { validateRequest } from '../middlewares/validateRequest';
import { createOfftakeSchema } from '../schemas/offtake.schemas';

const router = Router();

router.post(
  '/livestock/:livestockId',
  authenticateJWT,
//   requireRoles(['ADMIN', 'FARM_KEEPER', 'COWORKER']),
  validateRequest(createOfftakeSchema),
  createOfftake
);

router.get(
  '/livestock/:livestockId',
  authenticateJWT,
  getLivestockOfftakes
);

router.get(
  '/',
  authenticateJWT,
  getAllOfftakes
);

export const offtakeRouter = router;