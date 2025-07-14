"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLivestock = exports.updateLivestock = exports.getLivestockCounts = exports.getAllLivestock = exports.getLivestock = exports.addLivestock = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const selects_1 = require("../prisma/selects");
const addLivestock = async (req, res, next) => {
    try {
        const { tagId, type, breed, birthDate, healthStatus, weight, gender, livestockSource, livestockPurpose } = req.body;
        const addedById = req.user.id;
        const livestock = await prisma_1.default.livestock.create({
            data: {
                tagId,
                type,
                breed,
                birthDate: birthDate ? new Date(birthDate) : null,
                healthStatus,
                weight: weight ? parseFloat(weight) : null,
                gender,
                livestockSource,
                livestockPurpose,
                addedById,
            },
            include: {
                addedBy: { select: selects_1.userSelect }, // Include the user who added the livestock
            },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock successfully added', { livestock }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.addLivestock = addLivestock;
const getLivestock = async (req, res, next) => {
    try {
        const livestock = await prisma_1.default.livestock.findUnique({
            where: {
                id: req.params.livestockId,
            },
            include: {
                addedBy: { select: selects_1.userSelect },
                updatedBy: { select: selects_1.userSelect }
            },
        });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock retrieved successfully', { livestock });
    }
    catch (error) {
        next(error);
    }
};
exports.getLivestock = getLivestock;
const getAllLivestock = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        const where = {
            ...(type && { type: String(type) })
        };
        const livestock = await prisma_1.default.livestock.findMany({
            where,
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
            include: { addedBy: { select: selects_1.userSelect } },
            orderBy: { createdAt: 'desc' },
        });
        const total = await prisma_1.default.livestock.count({ where });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock retrieved successfully', {
            livestock,
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
exports.getAllLivestock = getAllLivestock;
const getLivestockCounts = async (req, res, next) => {
    try {
        const [totalLivestock, sickLivestock] = await Promise.all([
            prisma_1.default.livestock.count(),
            prisma_1.default.livestock.count({
                where: {
                    healthStatus: {
                        in: ['SICK', 'IN_TREATMENT', 'CRITICAL'] // Adjust as needed
                    },
                    sickness: {
                        some: {}
                    }
                }
            })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock counts retrieved', {
            totalLivestock,
            sickLivestock
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getLivestockCounts = getLivestockCounts;
const updateLivestock = async (req, res, next) => {
    try {
        const { tagId, type, breed, birthDate, healthStatus, weight, gender, livestockSource, livestockPurpose } = req.body;
        const updatedById = req.user.id; // Get current user ID from JWT
        const livestock = await prisma_1.default.livestock.update({
            where: {
                id: req.params.livestockId,
            },
            data: {
                tagId,
                type,
                breed,
                birthDate: birthDate ? new Date(birthDate) : null,
                healthStatus,
                weight: weight ? parseFloat(weight) : null,
                gender,
                livestockSource,
                livestockPurpose,
                updatedById
            },
            include: {
                addedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                    }
                },
                updatedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                    }
                }
            }
        });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock updated successfully', { livestock });
    }
    catch (error) {
        next(error);
    }
};
exports.updateLivestock = updateLivestock;
const deleteLivestock = async (req, res, next) => {
    try {
        const livestock = await prisma_1.default.livestock.findUnique({
            where: { id: req.params.livestockId },
        });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        await prisma_1.default.livestock.delete({
            where: { id: req.params.livestockId, },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock deleted successfully!', { livestock });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteLivestock = deleteLivestock;
