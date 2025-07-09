"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offtakeRouter = void 0;
// routes/offtake.routes.ts
const express_1 = require("express");
const offtake_controller_1 = require("../contollers/offtake.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const offtake_schemas_1 = require("../schemas/offtake.schemas");
const router = (0, express_1.Router)();
router.post('/livestock/:livestockId', errorHandler_1.authenticateJWT, 
//   requireRoles(['ADMIN', 'FARM_KEEPER', 'COWORKER']),
(0, validateRequest_1.validateRequest)(offtake_schemas_1.createOfftakeSchema), offtake_controller_1.createOfftake);
router.get('/livestock/:livestockId', errorHandler_1.authenticateJWT, offtake_controller_1.getLivestockOfftakes);
router.get('/', errorHandler_1.authenticateJWT, offtake_controller_1.getAllOfftakes);
exports.offtakeRouter = router;
