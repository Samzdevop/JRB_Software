import { z } from 'zod';

export const taxQuerySchema = z.object({
  body: z.object({
    query: z.string().min(5, 'Please provide a meaningful query (at least five characters long)')
  })
});

