"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentSelect = exports.userSelect = void 0;
exports.userSelect = {
    id: true,
    fullName: true,
    email: true,
    phone: true,
    company: true,
    jobTitle: true,
    // password: false,
    // isSuspended: false,
    avatar: true,
    location: true,
    createdAt: true,
    updatedAt: true,
};
exports.documentSelect = {
    id: true,
    title: true,
    fileUrl: true,
    fileSize: true,
    uploadedById: true,
    // content: false,
    // processed: true,
};
