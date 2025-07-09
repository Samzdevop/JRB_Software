"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVaccination = exports.updateVaccination = exports.getAllVaccinations = exports.getLivestockVaccinations = exports.getVaccination = exports.recordVaccination = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const selects_1 = require("../prisma/selects");
const recordVaccination = async (req, res, next) => {
    try {
        const { dateofVaccination, vaccineType, dosage, administeredBy, nextDueDate } = req.body;
        const livestockId = req.params.livestockId;
        const recordedById = req.user.id;
        const livestock = await prisma_1.default.livestock.findUnique({
            where: { id: livestockId }
        });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        const vaccination = await prisma_1.default.vaccination.create({
            data: {
                livestockId,
                dateofVaccination: new Date(dateofVaccination),
                vaccineType,
                dosage: parseFloat(dosage),
                administeredBy,
                nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
                recordedById
            },
            include: {
                livestock: true,
                recordedBy: { select: selects_1.userSelect },
            },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Vaccination successfully recorded', { vaccination }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.recordVaccination = recordVaccination;
//Get vaccination by vaccinationId
const getVaccination = async (req, res, next) => {
    try {
        const vaccination = await prisma_1.default.vaccination.findUnique({
            where: { id: req.params.vaccinationId },
            include: {
                livestock: true,
                recordedBy: { select: selects_1.userSelect },
            },
        });
        if (!vaccination)
            throw new NotFoundError_1.NotFoundError('Vaccination record not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Vaccination retrieved successfully', { vaccination });
    }
    catch (error) {
        next(error);
    }
};
exports.getVaccination = getVaccination;
// Get all vaccinations for specific livestock
const getLivestockVaccinations = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const vaccinations = await prisma_1.default.vaccination.findMany({
            where: { livestockId: req.params.livestockId },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
            include: {
                livestock: true,
                recordedBy: { select: selects_1.userSelect },
            },
            orderBy: { dateofVaccination: 'desc' },
        });
        const total = await prisma_1.default.vaccination.count({
            where: { livestockId: req.params.livestockId }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock vaccinations retrieved successfully', {
            vaccinations,
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
exports.getLivestockVaccinations = getLivestockVaccinations;
// Get all vaccinations with optional livestock filter
const getAllVaccinations = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, livestockId } = req.query;
        const where = {
            ...(livestockId && { livestockId: String(livestockId) }),
        };
        const vaccinations = await prisma_1.default.vaccination.findMany({
            where,
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
            include: {
                livestock: true,
                recordedBy: { select: selects_1.userSelect },
            },
            orderBy: { dateofVaccination: 'desc' },
        });
        const total = await prisma_1.default.vaccination.count({ where });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Vaccination records retrieved successfully', {
            vaccinations,
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
exports.getAllVaccinations = getAllVaccinations;
const updateVaccination = async (req, res, next) => {
    try {
        const { dateofVaccination, vaccineType, dosage, administeredBy, nextDueDate } = req.body;
        const requestingUser = req.user;
        const existingRecord = await prisma_1.default.vaccination.findUnique({
            where: { id: req.params.vaccinationId },
            // include: { recordedBy: true }
        });
        if (!existingRecord)
            throw new NotFoundError_1.NotFoundError('Vaccination record not found');
        // Check permissions
        const isOwner = existingRecord.recordedById === requestingUser.id;
        const isPrivileged = ['ADMIN', 'FARM_KEEPER'].includes(requestingUser.role);
        if (!isOwner && !isPrivileged) {
            throw new ForbiddenError_1.ForbiddenError('You do not have permission to update this record');
        }
        const vaccination = await prisma_1.default.vaccination.update({
            where: { id: req.params.vaccinationId },
            data: {
                dateofVaccination: dateofVaccination ? new Date(dateofVaccination) : undefined,
                vaccineType,
                dosage: dosage ? parseFloat(dosage) : undefined,
                administeredBy,
                nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
            },
            include: {
                livestock: true,
                recordedBy: { select: selects_1.userSelect },
            },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Vaccination updated successfully', { vaccination });
    }
    catch (error) {
        next(error);
    }
};
exports.updateVaccination = updateVaccination;
const deleteVaccination = async (req, res, next) => {
    try {
        const requestingUser = req.user;
        const existingRecord = await prisma_1.default.vaccination.findUnique({
            where: { id: req.params.vaccinationId },
            include: { recordedBy: true }
        });
        if (!existingRecord)
            throw new NotFoundError_1.NotFoundError('Vaccination record not found');
        // Check permissions
        const isOwner = existingRecord.recordedById === requestingUser.id;
        const isPrivileged = ['ADMIN', 'FARM_KEEPER'].includes(requestingUser.role);
        if (!isOwner && !isPrivileged) {
            throw new ForbiddenError_1.ForbiddenError('You do not have permission to delete this record');
        }
        await prisma_1.default.vaccination.delete({
            where: { id: req.params.vaccinationId },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Vaccination record deleted successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteVaccination = deleteVaccination;
