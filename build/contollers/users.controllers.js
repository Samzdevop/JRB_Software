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
const ForbiddenError_1 = require("../errors/ForbiddenError");
const phoneFormat_1 = require("../utils/phoneFormat");
const BadRequestError_1 = require("../errors/BadRequestError");
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
        const { fullName, location, avatar, phone } = req.body;
        if (phone && !(0, phoneFormat_1.validatePhoneNumber)(phone)) {
            throw new BadRequestError_1.BadRequestError('Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)');
        }
        const normalizedPhone = phone ? (0, phoneFormat_1.normalizePhoneNumber)(phone) : undefined;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { fullName, location, avatar, phone: normalizedPhone },
            select: selects_1.userSelect
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Profile updated successfully', updatedUser);
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
const getAllUsers = async (req, res, next) => {
    try {
        const requestingUser = req.user; // Get the current user
        const { page = 1, limit = 10 } = req.query;
        // Determine which roles the current user can access
        let allowedRoles = [];
        if (requestingUser.role === 'ADMIN') {
            allowedRoles = ['FARM_KEEPER', 'COWORKER'];
        }
        else if (requestingUser.role === 'FARM_KEEPER') {
            allowedRoles = ['COWORKER'];
        }
        else {
            throw new ForbiddenError_1.ForbiddenError('You do not have permission to view users');
        }
        const where = {
            role: { in: allowedRoles },
            id: { not: requestingUser.id } // Exclude the current user
        };
        const [users, total] = await Promise.all([
            prisma_1.default.user.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                select: selects_1.userSelect,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.user.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Users retrieved successfully', {
            users,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
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
