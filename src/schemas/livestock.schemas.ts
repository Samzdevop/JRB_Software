import { z } from "zod";

export const addLivestockSchema = z.object({
    body: z.object({
        tagId: z.string().min(1, "Tag ID is required"),
        type: z.string().min(1, "Type is required"),
        breed: z.string().optional(),
        healthStatus: z.enum(['HEALTHY', 'SICK', 'IN_TREATMENT', 'RECOVERING', 'CRITICAL']).default('HEALTHY'),
        birthDate: z.string().optional(),
        weight: z.number().min(0, "Weight must be a positive number").optional(),
        gender: z.string().min(1, 'Gender is required'),
        livestockSource: z.string().optional(),
        livestockPurpose: z.string().min(1, 'Purpose is required'),
    }),
});


export const updateLivestockSchema = z.object({
  body: z.object({
    tagId: z.string().min(1, 'Tag ID is required').optional(),
    type: z.string().min(1, 'Type is required').optional(),
    breed: z.string().optional(),
    birthDate: z.string().optional(),
    healthStatus: z.enum(['HEALTHY', 'SICK', 'IN_TREATMENT', 'RECOVERING', 'CRITICAL']).optional(),
    weight: z.number().min(0, 'Weight must be positive').optional(),
    gender: z.string().min(1, 'Gender is required').optional(),
    livestockSource: z.string().optional(),
    livestockPurpose: z.string().optional()
  }),
});