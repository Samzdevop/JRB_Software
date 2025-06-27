import { z } from 'zod';

export const updateUserSchema = z.object({
	body: z.object({
		fullName: z.string().min(1, 'First Name is required').optional(),
		location: z.string().min(1, 'Last Name is required').optional(),
		imgUrl: z.string().url('Last Name is required').optional(),
	}),
});