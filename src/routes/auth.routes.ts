import { Router } from 'express';
import {
	login,
	register,
	requestVerificationCode,
	resetPassword,
	verifyAccount,
} from '../contollers/auth.controller';
import { validateRequest } from '../middlewares/validateRequest';
import {
	loginSchema,
	registerSchema,
	requestVerificationSchema,
	resetPasswordSchema,
	verifyAccountSchema,
} from '../schemas/auth.schemas';
import passport from 'passport';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';

export const authRouter = Router();

authRouter.post('/register', validateRequest(registerSchema), register);

authRouter.post('/login', validateRequest(loginSchema), login);

authRouter.post(
	'/resend',
	validateRequest(requestVerificationSchema),
	requestVerificationCode
);

authRouter.put('/verify', validateRequest(verifyAccountSchema), verifyAccount);

authRouter.put('/reset', validateRequest(resetPasswordSchema), resetPassword);

// Google Strategy
authRouter.get(
	'/google',
	passport.authenticate('google', { scope: ['profile', 'email'] })
);

authRouter.get(
	'/google/callback',
	passport.authenticate('google', { session: false }),
	(req, res) => {
		const { user, token } = req.user as any;
		res.json({
			message: 'Login successful',
			user,
			token,
		});
		sendSuccessResponse(res, 'Login successful', { user, token });
	}
);

authRouter.get('/failure', (_req, res) => {
	res.status(401).json({ error: 'Failed to authenticate' });
});