"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checklistRouter = void 0;
// routes/checklist.routes.ts
const express_1 = require("express");
const checkList_controller_1 = require("../contollers/checkList.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const document_schemas_1 = require("../schemas/document.schemas");
exports.checklistRouter = (0, express_1.Router)();
exports.checklistRouter.post('/:documentId', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(document_schemas_1.addToChecklistSchema), checkList_controller_1.addToChecklist);
exports.checklistRouter.get('/:documentId', errorHandler_1.authenticateJWT, checkList_controller_1.getChecklist);
exports.checklistRouter.patch('/:checklistId', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(document_schemas_1.updateChecklistSchema), checkList_controller_1.updateChecklistItem);
exports.checklistRouter.delete('/:checklistId', errorHandler_1.authenticateJWT, checkList_controller_1.deleteChecklistItem);
