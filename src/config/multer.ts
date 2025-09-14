// config/multer.ts
import multer from 'multer';

// File filter for PDF and Word documents
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/pdf', // PDF files
    'application/msword', // .doc files
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx files
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Word documents (.doc, .docx) are allowed'));
  }
};

// Configure multer with memory storage
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    fields: 5
  },
});

// For memory storage, these functions are simplified
export const getFileUrl = (filename: string): string => {
  return `memory://${filename}`;
};

export const deleteFile = async (filename: string): Promise<void> => {
  console.log(`File ${filename} would be deleted (memory storage)`);
};


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