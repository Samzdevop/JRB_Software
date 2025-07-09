"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vaccinationRouter = void 0;
const express_1 = require("express");
const vaccination_controller_1 = require("../contollers/vaccination.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const roleCheck_1 = require("../middlewares/roleCheck");
const validateRequest_1 = require("../middlewares/validateRequest");
const vaccination_schemas_1 = require("../schemas/vaccination.schemas");
exports.vaccinationRouter = (0, express_1.Router)();
// Record new vaccination for specific livestock
exports.vaccinationRouter.post('/livestock/:livestockId/vaccinations', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER', 'VET']), (0, validateRequest_1.validateRequest)(vaccination_schemas_1.vaccinationSchema), vaccination_controller_1.recordVaccination);
// Get specific vaccination record
exports.vaccinationRouter.get('/vaccinations/:vaccinationId', errorHandler_1.authenticateJWT, vaccination_controller_1.getVaccination);
// Get all vaccinations for specific livestock
exports.vaccinationRouter.get('/livestock/:livestockId/vaccinations', errorHandler_1.authenticateJWT, vaccination_controller_1.getLivestockVaccinations);
// Get all vaccinations (with optional livestock filter)
exports.vaccinationRouter.get('/vaccinations', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER']), vaccination_controller_1.getAllVaccinations);
// Update vaccination record
exports.vaccinationRouter.patch('/vaccinations/:vaccinationId', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER', 'VET']), (0, validateRequest_1.validateRequest)(vaccination_schemas_1.updatevaccinationSchema), vaccination_controller_1.updateVaccination);
// Delete vaccination record
exports.vaccinationRouter.delete('/vaccinations/:vaccinationId', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER']), vaccination_controller_1.deleteVaccination);
