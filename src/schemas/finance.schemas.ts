import { z } from 'zod';

export const financialTransactionSchema = z.object({
  body: z.object({
    type: z.enum(['INCOME', 'EXPENSE']),
    referenceNumber: z.string().min(1, "Reference number is required"),
    title: z.string().min(1, "Title is required"),
    amount: z.string()
      .min(1, "Amount is required")
      .refine(val => !isNaN(parseFloat(val)), "Amount must be a number"),
    paymentMethod: z.string().min(1, "Payment method is required"),
    date: z.string().min(1, "Date is required"),
    description: z.string().optional(),
    partyName: z.string().min(1, "Party name is required (buyer/vendor)")
  })
});