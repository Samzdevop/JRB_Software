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
    email: z.string().email("Invalid email format").regex(/^[0-10]+$/, "Phone must contain only numbers").optional(),
    phone: z.string().min(11, "Phone number must be at least 11 digits").optional(),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    role: z.enum(['FARM_KEEPER', 'COWORKER']).default('COWORKER'), // Default to COWORKER
  }).refine(data => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email"],
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format").optional(),
    phone: z.string().min(11, "Invalid phone number format").optional(),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }).refine(data => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email",]
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