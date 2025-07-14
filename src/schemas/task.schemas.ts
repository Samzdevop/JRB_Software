import { z } from "zod";

export const createTaskSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Task name is required"),
    description: z.string().min(1, "Description is required"),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    dueDate: z.string().min(1, "Due date is required"),
    assignedToId: z.string().min(1, "Assignee ID is required")
  }),
});

export const updateTaskStatusSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'])
  }),
});