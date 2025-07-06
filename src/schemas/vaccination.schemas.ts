import { z } from "zod";

export const vaccinationSchema = z.object({
    body: z.object({
        dateofVaccination: z.string().min(1, "Date of vaccination is required"),
        vaccineType: z.string().min(1, "Vaccine name is required"),
        dosage: z.number().min(0, "Dosage is required"),
        administeredBy: z.string().min(1, "Administered by is required"),
        nextDueDate: z.string().optional(),
    }),
});
export const updatevaccinationSchema = z.object({
    body: z.object({
        dateofVaccination: z.string().min(1, "Date of vaccination is required").optional(),
        vaccineType: z.string().min(1, "Vaccine name is required").optional(),
        dosage: z.number().min(0, "Dosage is required").optional(),
        administeredBy: z.string().min(1, "Administered by is required").optional(),
        nextDueDate: z.string().optional().optional(),
    }),
});