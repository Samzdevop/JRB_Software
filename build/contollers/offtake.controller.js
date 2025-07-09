"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllOfftakes = exports.getLivestockOfftakes = exports.createOfftake = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const createOfftake = async (req, res, next) => {
    try {
        const { type, dateOfEvent, destination, price, causeOfDeath, notes } = req.body;
        const livestockId = req.params.livestockId;
        const recordedById = req.user.id;
        const livestock = await prisma_1.default.livestock.findUnique({ where: { id: livestockId } });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        const offtake = await prisma_1.default.offtakeRecord.create({
            data: {
                livestockId,
                type,
                dateOfEvent: new Date(dateOfEvent),
                destination: type === 'SALE' ? destination : null,
                price: type === 'SALE' ? price : null,
                causeOfDeath: type === 'DEATH' ? causeOfDeath : null,
                notes,
                recordedById
            },
            include: {
                livestock: true,
                recordedBy: { select: { id: true, fullName: true, email: true } },
            },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Offtake recorded', { offtake }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createOfftake = createOfftake;
const getLivestockOfftakes = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const livestockId = req.params.livestockId;
        const [offtakes, total] = await Promise.all([
            prisma_1.default.offtakeRecord.findMany({
                where: { livestockId },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { dateOfEvent: 'desc' },
                include: { livestock: true },
            }),
            prisma_1.default.offtakeRecord.count({ where: { livestockId } })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Offtakes retrieved', {
            offtakes,
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
exports.getLivestockOfftakes = getLivestockOfftakes;
const getAllOfftakes = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        const where = type ? { type: type } : {};
        const [offtakes, total] = await Promise.all([
            prisma_1.default.offtakeRecord.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { dateOfEvent: 'desc' },
                include: { livestock: true },
            }),
            prisma_1.default.offtakeRecord.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'All offtakes', {
            offtakes,
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
exports.getAllOfftakes = getAllOfftakes;
