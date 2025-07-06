import { z } from "zod";

export const adminRegisterSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "First Name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "First Name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    role: z.enum(['FARM_KEEPER', 'COWORKER']).default('COWORKER'), // Default to COWORKER
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }),
});

export const requestVerificationSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

export const verifyAccountSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    verificationCode: z
      .string()
      .min(4, "Verification code must be at least 4 digits long"),
  }),
});
export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z
      .string()
      .min(8, "Confirm Password must be at least 8 characters long"),
    verificationCode: z
      .string()
      .min(4, "Verification code must be at least 4 digits long"),
  }),
});