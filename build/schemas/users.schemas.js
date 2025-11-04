"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = void 0;
const zod_1 = require("zod");
const phoneFormat_1 = require("../utils/phoneFormat");
exports.updateUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, 'Full name is required').optional(),
        location: zod_1.z.string().min(1, 'Location is required').optional(),
        avatar: zod_1.z.string().url('Avatar must be a valid URL').optional(),
        phone: zod_1.z.string()
            .min(10, "Phone must be at least 10 digits")
            .refine((val) => (0, phoneFormat_1.validatePhoneNumber)(val), {
            message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
        })
            .optional()
    }),
});
