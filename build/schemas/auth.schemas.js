"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.verifyAccountSchema = exports.requestVerificationSchema = exports.loginSchema = exports.adminRegisterSchema = void 0;
const zod_1 = require("zod");
exports.adminRegisterSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, "First Name is required"),
        email: zod_1.z.string().email("Invalid email format"),
        jobTitle: zod_1.z.string().min(1, "Job Title is required").optional(),
        company: zod_1.z.string().min(1, "Company is required").optional(),
        location: zod_1.z.string().min(1, "Location is required").optional(),
        password: zod_1.z.string().min(8, "Password must be at least 8 characters long"),
    }),
});
// export const registerSchema = z.object({
//   body: z.object({
//     fullName: z.string().min(1, "First Name is required"),
//     email: z.string().email("Invalid email format").regex(/^[0-10]+$/, "Phone must contain only numbers").optional(),
//     phone: z.string()
//       .min(10, "Phone must be at least 10 digits")
//       .refine((val) => validatePhoneNumber(val), {
//         message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
//       })
//     .optional(),
//     password: z.string().min(8, "Password must be at least 8 characters long"),
//     role: z.enum(['FARM_KEEPER', 'COWORKER']).default('COWORKER'), // Default to COWORKER
//   }).refine(data => data.email || data.phone, {
//     message: "Either email or phone number is required",
//     path: ["email"],
//   }),
// });
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format").optional(),
        phone: zod_1.z.string().min(11, "Invalid phone number format").optional(),
        password: zod_1.z.string().min(8, "Password must be at least 8 characters long"),
    }).refine(data => data.email || data.phone, {
        message: "Either email or phone number is required",
        path: ["email",]
    }),
});
exports.requestVerificationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
    }),
});
exports.verifyAccountSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
        verificationCode: zod_1.z
            .string()
            .min(4, "Verification code must be at least 4 digits long"),
    }),
});
exports.resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
        password: zod_1.z.string().min(8, "Password must be at least 8 characters long"),
        confirmPassword: zod_1.z
            .string()
            .min(8, "Confirm Password must be at least 8 characters long"),
        verificationCode: zod_1.z
            .string()
            .min(4, "Verification code must be at least 4 digits long"),
    }),
});
