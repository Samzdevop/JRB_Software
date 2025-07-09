"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const generateToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        ...(user.email && { email: user.email }),
        ...(user.phone && { phone: user.phone })
    }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRY || '1h',
    });
};
exports.default = generateToken;
