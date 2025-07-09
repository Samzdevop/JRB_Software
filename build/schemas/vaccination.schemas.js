"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatevaccinationSchema = exports.vaccinationSchema = void 0;
const zod_1 = require("zod");
exports.vaccinationSchema = zod_1.z.object({
    body: zod_1.z.object({
        dateofVaccination: zod_1.z.string().min(1, "Date of vaccination is required"),
        vaccineType: zod_1.z.string().min(1, "Vaccine name is required"),
        dosage: zod_1.z.number().min(0, "Dosage is required"),
        administeredBy: zod_1.z.string().min(1, "Administered by is required"),
        nextDueDate: zod_1.z.string().optional(),
    }),
});
exports.updatevaccinationSchema = zod_1.z.object({
    body: zod_1.z.object({
        dateofVaccination: zod_1.z.string().min(1, "Date of vaccination is required").optional(),
        vaccineType: zod_1.z.string().min(1, "Vaccine name is required").optional(),
        dosage: zod_1.z.number().min(0, "Dosage is required").optional(),
        administeredBy: zod_1.z.string().min(1, "Administered by is required").optional(),
        nextDueDate: zod_1.z.string().optional().optional(),
    }),
});
