// utils/fileExtractors.ts
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { pageRenderWithPageNumber } from './documentHelpers';

export interface FileExtractionResult {
  text: string;
  pageCount?: number;
  metadata?: Record<string, any>;
}

export const extractTextFromFile = async (
  fileBuffer: Buffer, 
  fileName: string, 
  mimeType: string
): Promise<FileExtractionResult> => {
  try {
    // Handle PDF files
    if (mimeType === 'application/pdf') {
      const pdfData = await pdf(fileBuffer, {
        pagerender: pageRenderWithPageNumber
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
      
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      
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
  } catch (error) {
    console.error('Error extracting text from file:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to process ${fileName}: ${errorMessage}`);
  }
};