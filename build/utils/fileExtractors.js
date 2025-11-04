"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromFile = void 0;
// utils/fileExtractors.ts
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
const documentHelpers_1 = require("./documentHelpers");
const extractTextFromFile = async (fileBuffer, fileName, mimeType) => {
    try {
        // Handle PDF files
        if (mimeType === 'application/pdf') {
            const pdfData = await (0, pdf_parse_1.default)(fileBuffer, {
                pagerender: documentHelpers_1.pageRenderWithPageNumber
            });
            return {
                text: pdfData.text,
                pageCount: pdfData.numpages,
                metadata: pdfData.info
            };
        }
        // Handle Word documents (.doc, .docx)
        if (mimeType === 'application/msword' ||
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth_1.default.extractRawText({ buffer: fileBuffer });
            return {
                text: result.value,
                pageCount: undefined, // Mammoth doesn't provide page count
                metadata: {
                    warnings: result.messages.filter(m => m.type === 'warning'),
                    originalName: fileName
                }
            };
        }
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
    catch (error) {
        console.error('Error extracting text from file:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to process ${fileName}: ${errorMessage}`);
    }
};
exports.extractTextFromFile = extractTextFromFile;
