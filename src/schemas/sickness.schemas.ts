import { z } from 'zod';

export const reportSicknessSchema = z.object({
    body: z.object({
        dateOfObservation: z.string().min(1, "Date of observation is required"),
        observedSymptoms: z.string().min(1, "Observed symptoms are required"),
        suspectedCause: z.string().optional(),
        notes: z.string().optional(),
        healthStatus: z.enum(['SICK', 'CRITICAL']).optional(),
    }),
});

