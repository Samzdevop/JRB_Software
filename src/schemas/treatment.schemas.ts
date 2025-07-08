import { z } from "zod";

export const recordTreatmentSchema = z.object({
  body: z.object({
    dateOfTreatment: z.string().min(1, "Date of treatment is required"),
    treatmentType: z.string().min(1, "Treatment type is required"),
    dosage: z.number().min(0, "Dosage must be positive"),
    cause: z.string().min(1, "Cause is required"),
    administeredBy: z.string().min(1, "Administered by is required"),
    nextDueDate: z.string().optional(),
  }),
});