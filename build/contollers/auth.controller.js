"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.verifyAccount = exports.requestVerificationCode = exports.login = exports.register = exports.adminRegister = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const generateToken_1 = __importDefault(require("../utils/generateToken"));
const argon2_1 = require("argon2");
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const UnauthorizedError_1 = require("../errors/UnauthorizedError");
const generateVerificationCode_1 = require("../utils/generateVerificationCode");
const BadRequestError_1 = require("../errors/BadRequestError");
const mail_services_1 = require("../services/mail.services");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const mailTemplate_1 = require("../utils/mailTemplate");
const dateExpiration_1 = require("../utils/dateExpiration");
const selects_1 = require("../prisma/selects");
const ConflictError_1 = require("../errors/ConflictError");
// import { isValid } from "zod";
const adminRegister = async (req, res, next) => {
    try {
        const { email, fullName, password } = req.body;
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            throw new ForbiddenError_1.ForbiddenError("User already registered! Please proceed to login.");
        const hashedPassword = await (0, argon2_1.hash)(password);
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)().toString();
        const data = {
            email,
            password: hashedPassword,
            fullName,
            verificationCode,
            verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
        };
        await prisma_1.default.user.create({
            data,
        });
        const html = (0, mailTemplate_1.render)("verification", {
            fullName,
            verificationCode,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Agritech" samzdevop@yahoo.com`,
            subject: "Verify your Agritech Account",
            text: "",
            html,
        };
        if (process.env.NODE_ENV !== "test")
            (0, mail_services_1.sendCustomMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Account successfully created, kindly verify your account!", {}, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.adminRegister = adminRegister;
const register = async (req, res, next) => {
    try {
        const { email, phone, fullName, password, role } = req.body;
        const existingUser = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email: email || undefined },
                    { phone: phone || undefined }
                ]
            }
        });
        if (existingUser) {
            const conflicts = [];
            if (existingUser.email === email)
                conflicts.push("email");
            if (existingUser.phone === phone)
                conflicts.push("phone");
            throw new ConflictError_1.ConflictError(`User already exists with this ${conflicts.join(" and ")}`);
        }
        const hashedPassword = await (0, argon2_1.hash)(password);
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)().toString();
        await prisma_1.default.user.create({
            data: {
                email,
                phone,
                password: hashedPassword,
                fullName,
                verificationCode,
                verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
                role: role || "COWORKER",
                isVerified: true
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Registeration successfully", {}, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    const { email, phone, password } = req.body;
    try {
        const user = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    // Check for email or phone
                    { email: email ?? undefined },
                    { phone: phone ?? undefined }
                ]
            },
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        const isPasswordValid = await (0, argon2_1.verify)(user.password || "$passwordless", password);
        if (!isPasswordValid)
            throw new UnauthorizedError_1.UnauthorizedError("Invalid credentials");
        if (!user.isVerified)
            throw new UnauthorizedError_1.UnauthorizedError("Account not verified!");
        if (user.isSuspended)
            throw new UnauthorizedError_1.UnauthorizedError("Account suspended! Kindly reachout to support@penetralia.com");
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });
        const userData = await prisma_1.default.user.findUnique({
            where: { id: user.id },
            select: selects_1.userSelect
        });
        const token = (0, generateToken_1.default)({
            id: user.id,
            // ...(user.email && {email: user.email}),
            // ...(user.phone && {phone: user.phone})
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Login successful", {
            token,
            user: userData
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const requestVerificationCode = async (req, res, next) => {
    const { email } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)().toString();
        await prisma_1.default.user.update({
            where: { email },
            data: {
                verificationCode,
                verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
            },
        });
        const html = (0, mailTemplate_1.render)("resend", {
            verificationCode,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Penetralia" samzdevop@yahoo.com`,
            subject: "Reset your Agritech Password",
            text: "",
            html,
        };
        if (process.env.NODE_ENV !== "test")
            (0, mail_services_1.sendCustomMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Verification code successfully sent");
    }
    catch (error) {
        next(error);
    }
};
exports.requestVerificationCode = requestVerificationCode;
const verifyAccount = async (req, res, next) => {
    const { email, verificationCode } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        if (verificationCode !== user.verificationCode)
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        if ((0, dateExpiration_1.compareDates)(user.verificationExpires || new Date(), new Date(), "before"))
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        await prisma_1.default.user.update({
            where: { email },
            data: { isVerified: true, verificationCode: "0" },
        });
        const html = (0, mailTemplate_1.render)("welcome", {
            fullName: user.fullName,
            verificationCode,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Penetralia" samzdevop@yahoo.com`,
            subject: "Welcome to Agritech Africa",
            text: "",
            html,
        };
        if (process.env.NODE_ENV !== "test")
            (0, mail_services_1.sendCustomMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Account verification successful");
    }
    catch (error) {
        next(error);
    }
};
exports.verifyAccount = verifyAccount;
const resetPassword = async (req, res, next) => {
    const { email, password, confirmPassword, verificationCode } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        if (password !== confirmPassword)
            throw new BadRequestError_1.BadRequestError(`Password don't match`);
        if (verificationCode !== user.verificationCode)
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        if ((0, dateExpiration_1.compareDates)(user.verificationExpires || new Date(), new Date(), "before"))
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        const hashedPassword = await (0, argon2_1.hash)(password);
        await prisma_1.default.user.update({
            where: { email },
            data: { password: hashedPassword, verificationCode: "0" },
        });
        const html = (0, mailTemplate_1.render)("reset", {
            fullName: user.fullName,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Penetralia" samzdevop@yahoo.com`,
            subject: "Agritech Password Reset Successful",
            text: "",
            html,
        };
        if (process.env.NODE_ENV !== "test")
            (0, mail_services_1.sendCustomMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Password reset successful");
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
