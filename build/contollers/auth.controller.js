"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.adminRegister = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const generateToken_1 = __importDefault(require("../utils/generateToken"));
const argon2_1 = require("argon2");
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const UnauthorizedError_1 = require("../errors/UnauthorizedError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const selects_1 = require("../prisma/selects");
// import { isValid } from "zod";
const adminRegister = async (req, res, next) => {
    try {
        const { email, fullName, password, jobTitle, company, location } = req.body;
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            throw new ForbiddenError_1.ForbiddenError("User already registered! Please proceed to login.");
        const hashedPassword = await (0, argon2_1.hash)(password);
        const data = {
            email,
            password: hashedPassword,
            fullName,
            jobTitle,
            company,
            location
        };
        await prisma_1.default.user.create({
            data,
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Account successfully created, kindly verify your account!", {}, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.adminRegister = adminRegister;
const login = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        const validPassword = await (0, argon2_1.verify)(user.password || "$passwordless", password);
        if (!validPassword)
            throw new UnauthorizedError_1.UnauthorizedError("Invalid credentials");
        const availableDocument = await prisma_1.default.document.findFirst({
            orderBy: { uploadedAt: 'desc' }, // Get the most recent document
            select: { id: true, title: true }
        });
        const userData = await prisma_1.default.user.findUnique({
            where: { id: user.id },
            select: selects_1.userSelect
        });
        if (!userData)
            throw new NotFoundError_1.NotFoundError("User data not found");
        const token = (0, generateToken_1.default)({ email, id: user.id });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Login successful", {
            token,
            user: {
                ...userData,
                documentId: availableDocument?.id || null,
                documentTitle: availableDocument?.title || null
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
