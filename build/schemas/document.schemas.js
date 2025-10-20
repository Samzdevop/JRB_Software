"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNoteSchema = exports.updateChecklistSchema = exports.addToChecklistSchema = exports.searchDocumentSchema = exports.uploadDocumentSchema = void 0;
const zod_1 = require("zod");
exports.uploadDocumentSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required'),
    }),
    params: zod_1.z.object({
        documentId: zod_1.z.string().min(1, 'Document ID is required').optional(),
    }),
});
exports.searchDocumentSchema = zod_1.z.object({
    body: zod_1.z.object({
        query: zod_1.z.string().min(1, 'Search query is required'),
    }),
});
exports.addToChecklistSchema = zod_1.z.object({
    body: zod_1.z.object({
        item: zod_1.z.string().min(1, 'Checklist item is required'),
    }),
    params: zod_1.z.object({
        documentId: zod_1.z.string().min(1, 'Document ID is required'),
    }),
});
exports.updateChecklistSchema = zod_1.z.object({
    body: zod_1.z.object({
        completed: zod_1.z.boolean(),
    }),
});
exports.createNoteSchema = zod_1.z.object({
    body: zod_1.z.object({
        body: zod_1.z.string().min(1, 'Note body is required'),
    }),
    params: zod_1.z.object({
        documentId: zod_1.z.string().min(1, 'Document ID is required'),
    }),
});
