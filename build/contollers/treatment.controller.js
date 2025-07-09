"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTreatmentById = exports.getAllTreatments = exports.recordTreatment = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const selects_1 = require("../prisma/selects");
const recordTreatment = async (req, res, next) => {
    try {
        const { dateOfTreatment, treatmentType, dosage, cause, administeredBy, nextDueDate } = req.body;
        const livestockId = req.params.livestockId;
        const sicknessId = req.params.sicknessId; // Optional
        const recordedById = req.user.id;
        // Verify livestock exists
        const livestock = await prisma_1.default.livestock.findUnique({
            where: { id: livestockId }
        });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        // Verify sickness exists if provided
        if (sicknessId) {
            const sickness = await prisma_1.default.sickness.findUnique({
                where: { id: sicknessId }
            });
            if (!sickness)
                throw new NotFoundError_1.NotFoundError('Sickness record not found');
        }
        // Create treatment and update livestock status in a transaction
        const [treatment] = await prisma_1.default.$transaction([
            prisma_1.default.treatment.create({
                data: {
                    livestockId,
                    sicknessId,
                    dateOfTreatment: new Date(dateOfTreatment),
                    treatmentType,
                    dosage,
                    cause,
                    administeredBy,
                    nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
                    recordedById,
                },
                include: {
                    livestock: true,
                    sickness: true,
                    recordedBy: { select: selects_1.userSelect },
                },
            }),
            prisma_1.default.livestock.update({
                where: { id: livestockId },
                data: { isTreatment: true },
            }),
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Treatment successfully recorded', { treatment }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.recordTreatment = recordTreatment;
// Get all treatments
const getAllTreatments = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, livestockId, sicknessId } = req.query;
        const where = {
            ...(livestockId && { livestockId: String(livestockId) }),
            ...(sicknessId && { sicknessId: String(sicknessId) })
        };
        const treatments = await prisma_1.default.treatment.findMany({
            where,
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
            include: {
                livestock: true,
                sickness: true,
                recordedBy: { select: selects_1.userSelect }
            },
            orderBy: { dateOfTreatment: 'desc' }
        });
        const total = await prisma_1.default.treatment.count({ where });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Treatments retrieved', {
            treatments,
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
exports.getAllTreatments = getAllTreatments;
// Get single treatment
const getTreatmentById = async (req, res, next) => {
    try {
        const treatment = await prisma_1.default.treatment.findUnique({
            where: { id: req.params.treatmentId },
            include: {
                livestock: true,
                sickness: true,
                recordedBy: { select: selects_1.userSelect }
            }
        });
        if (!treatment)
            throw new NotFoundError_1.NotFoundError('Treatment record not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Treatment retrieved', { treatment });
    }
    catch (error) {
        next(error);
    }
};
exports.getTreatmentById = getTreatmentById;
