"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordTreatmentSchema = void 0;
const zod_1 = require("zod");
exports.recordTreatmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        dateOfTreatment: zod_1.z.string().min(1, "Date of treatment is required"),
        treatmentType: zod_1.z.string().min(1, "Treatment type is required"),
        dosage: zod_1.z.number().min(0, "Dosage must be positive"),
        cause: zod_1.z.string().min(1, "Cause is required"),
        administeredBy: zod_1.z.string().min(1, "Administered by is required"),
        nextDueDate: zod_1.z.string().optional(),
    }),
});
