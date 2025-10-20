"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../contollers/auth.controller");
const validateRequest_1 = require("../middlewares/validateRequest");
const auth_schemas_1 = require("../schemas/auth.schemas");
const passport_1 = __importDefault(require("passport"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/reg', (0, validateRequest_1.validateRequest)(auth_schemas_1.adminRegisterSchema), auth_controller_1.adminRegister);
// authRouter.post(
// 	'/register',
// 	authenticateJWT,
// 	requireRoles(['ADMIN', 'FARM_KEEPER']),
// 	validateRequest(registerSchema),
// 	register
// );
exports.authRouter.post('/login', (0, validateRequest_1.validateRequest)(auth_schemas_1.loginSchema), auth_controller_1.login);
// authRouter.post(
// 	'/resend',
// 	validateRequest(requestVerificationSchema),
// 	requestVerificationCode
// );
// authRouter.put('/verify', validateRequest(verifyAccountSchema), verifyAccount);
// authRouter.put('/reset', validateRequest(resetPasswordSchema), resetPassword);
// Google Strategy
exports.authRouter.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
exports.authRouter.get('/google/callback', passport_1.default.authenticate('google', { session: false }), (req, res) => {
    const { user, token } = req.user;
    res.json({
        message: 'Login successful',
        user,
        token,
    });
    (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Login successful', { user, token });
});
exports.authRouter.get('/failure', (_req, res) => {
    res.status(401).json({ error: 'Failed to authenticate' });
});
