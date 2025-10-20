"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteChecklistItem = exports.updateChecklistItem = exports.getChecklist = exports.addToChecklist = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const addToChecklist = async (req, res, next) => {
    try {
        const { item } = req.body;
        const { documentId } = req.params;
        const userId = req.user.id;
        // Verify document exists
        const document = await prisma_1.default.document.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new NotFoundError_1.NotFoundError('Document not found');
        }
        const checklist = await prisma_1.default.checklist.create({
            data: {
                item,
                documentId,
                userId,
            },
            include: {
                document: {
                    select: { id: true, title: true }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Item added to checklist', { checklist }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.addToChecklist = addToChecklist;
const getChecklist = async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;
        const { completed } = req.query;
        const where = {
            userId,
            ...(documentId && { documentId: String(documentId) }),
            ...(completed !== undefined && { completed: completed === 'true' })
        };
        const checklist = await prisma_1.default.checklist.findMany({
            where,
            include: {
                document: {
                    select: { id: true, title: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Checklist retrieved', { checklist });
    }
    catch (error) {
        next(error);
    }
};
exports.getChecklist = getChecklist;
const updateChecklistItem = async (req, res, next) => {
    try {
        const { checklistId } = req.params;
        const { completed } = req.body;
        const checklist = await prisma_1.default.checklist.update({
            where: { id: checklistId },
            data: { completed },
            include: {
                document: {
                    select: { id: true, title: true }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Checklist item updated', { checklist });
    }
    catch (error) {
        next(error);
    }
};
exports.updateChecklistItem = updateChecklistItem;
const deleteChecklistItem = async (req, res, next) => {
    try {
        const { checklistId } = req.params;
        const userId = req.user.id;
        // Verify the checklist item belongs to the user
        const checklistItem = await prisma_1.default.checklist.findFirst({
            where: { id: checklistId, userId },
        });
        if (!checklistItem) {
            throw new NotFoundError_1.NotFoundError('Checklist item not found');
        }
        await prisma_1.default.checklist.delete({
            where: { id: checklistId },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Checklist item deleted successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteChecklistItem = deleteChecklistItem;
