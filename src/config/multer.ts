import multer from 'multer';
import path from 'path';
import fs from 'fs';


const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('📁 Multer file filter - MIME type:', file.mimetype);
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx files
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    console.log('file type allowed');
    cb(null, true);
  } else {
     console.log('File type not allowed:', file.mimetype);
    cb(new Error('Only PDF and Word documents (.doc, .docx) are allowed'));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, 
    fields: 5
  },
});


export const getFileUrl = (filename: string): string => {
  return `memory://${filename}`;
};

export const deleteFile = async (filename: string): Promise<void> => {
  console.log(`File ${filename} would be deleted (memory storage)`);
};




export const comparisonUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents (.doc, .docx) are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
});



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



const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Disk storage for avatars
export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      // Unique filename: userId + timestamp + original extension
      const ext = path.extname(file.originalname);
      const uniqueName = `${Date.now()}-${file.originalname.replace(/\s/g, '-')}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 }, 
});