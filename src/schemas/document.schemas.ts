import { z } from 'zod';

export const uploadDocumentSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
  }),
  params: z.object({
    documentId: z.string().min(1, 'Document ID is required').optional(),
  }),
});

export const searchDocumentSchema = z.object({
  body: z.object({
    query: z.string().min(1, 'Search query is required'),
  }),
});

export const addToChecklistSchema = z.object({
  body: z.object({
    item: z.string().min(1, 'Checklist item is required'),
  }),
  params: z.object({
    documentId: z.string().min(1, 'Document ID is required'), 
  }),
});

export const updateChecklistSchema = z.object({
  body: z.object({
    completed: z.boolean(),
  }),
});

export const createNoteSchema = z.object({
  body: z.object({
    body: z.string().min(1, 'Note body is required'),
  }),
  params: z.object({
    documentId: z.string().min(1, 'Document ID is required'),
  }),
});