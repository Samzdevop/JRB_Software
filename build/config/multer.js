"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.getFileUrl = exports.upload = void 0;
// config/multer.ts
const multer_1 = __importDefault(require("multer"));
// File filter for PDF and Word documents
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf', // PDF files
        'application/msword', // .doc files
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx files
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only PDF and Word documents (.doc, .docx) are allowed'));
    }
};
// Configure multer with memory storage
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        fields: 5
    },
});
// For memory storage, these functions are simplified
const getFileUrl = (filename) => {
    return `memory://${filename}`;
};
exports.getFileUrl = getFileUrl;
const deleteFile = async (filename) => {
    console.log(`File ${filename} would be deleted (memory storage)`);
};
exports.deleteFile = deleteFile;
// for disk storage and not memory storage
// export const deleteFile = async (filename: string): Promise<void> => {
//   try {
//     const filePath = path.join(uploadDir, filename);
//     if (fs.existsSync(filePath)) {
//       fs.unlinkSync(filePath);
//       console.log(`File deleted: ${filename}`);
//     }
//   } catch (error) {
//     console.error('Error deleting file:', error);
//     throw error;
//   }
// };
