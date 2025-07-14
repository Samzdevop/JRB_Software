"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportSicknessSchema = void 0;
const zod_1 = require("zod");
exports.reportSicknessSchema = zod_1.z.object({
    body: zod_1.z.object({
        dateOfObservation: zod_1.z.string().min(1, "Date of observation is required"),
        observedSymptoms: zod_1.z.string().min(1, "Observed symptoms are required"),
        suspectedCause: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        healthStatus: zod_1.z.enum(['SICK', 'CRITICAL']).optional(),
    }),
});
