// schemas/users.schemas.ts
import { z } from 'zod';
import { validatePhoneNumber } from '../utils/phoneFormat';

export const updateUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').optional(),
    location: z.string().min(1, 'Location is required').optional(),
    avatar: z.string().url('Avatar must be a valid URL').optional(),
    phone: z.string()
      .min(10, "Phone must be at least 10 digits")
      .refine((val) => validatePhoneNumber(val), {
        message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
      })
      .optional()
  }),
});