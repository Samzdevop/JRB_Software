"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = void 0;
// schemas/users.schemas.ts
const zod_1 = require("zod");
exports.updateUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, 'Full name is required').optional(),
        location: zod_1.z.string().min(1, 'Location is required').optional(),
        avatar: zod_1.z.string().url('Avatar must be a valid URL').optional(),
        phone: zod_1.z.string()
            .min(10, "Phone must be at least 10 digits")
            .regex(/^[0-9]+$/, "Phone must contain only numbers")
            .optional()
    }),
});
