"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.getUserById = exports.getAllUsers = exports.updateProfile = exports.getProfile = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const selects_1 = require("../prisma/selects");
// import { Prisma } from '@prisma/client';
const getProfile = async (req, res, next) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            select: selects_1.userSelect
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError('User not found');
        // user.password = '';
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Profile successfully retrieved', user);
    }
    catch (error) {
        next(error);
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fullName, location, company, jobTitle, avatar } = req.body;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { fullName, location, company, jobTitle, avatar },
            select: selects_1.userSelect
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Profile updated successfully', updatedUser);
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
const getAllUsers = async (_req, res, next) => {
    try {
        const users = await prisma_1.default.user.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ data: users });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllUsers = getAllUsers;
const getUserById = async (req, res, next) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.params.userId },
            select: selects_1.userSelect
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError('User not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'User retrieved successfully', user);
    }
    catch (error) {
        next(error);
    }
};
exports.getUserById = getUserById;
const deleteUser = async (req, res, next) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.params.userId }
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError('User not found');
        await prisma_1.default.user.delete({
            where: { id: req.params.userId },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'User permanently deleted successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;
