import { Router } from 'express';
import {
  compareWithPIADocument,
  getComparisonHistory,
  getComparisonResult,
} from '../contollers/documentComparison.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { comparisonUpload, upload } from '../config/multer';

const uploadMiddleware = comparisonUpload.single('document');


const handleUpload = (req: any, res: any, next: any) => {
  uploadMiddleware(req, res, (err: any) => {
    if (err) {
      console.log('❌ Multer error:', err.message);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 10MB.'
        });
      }
      if (err.message.includes('allowed')) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      return res.status(400).json({
        success: false,
        error: 'File upload failed: ' + err.message
      });
    }
// Log what we received
    console.log('📤 Upload processed:');
    console.log('   File:', req.file ? `Yes - ${req.file.originalname}` : 'No');
    console.log('   Body:', req.body);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please select a file with the field name "document".'
      });
    }
    
    next();
  });
};


export const documentComparisonRouter = Router();

documentComparisonRouter.post(
  '/compare',
  authenticateJWT,
  handleUpload,
//   uploadMiddleware,
  compareWithPIADocument
);


documentComparisonRouter.get(
  '/history',
  authenticateJWT,
  getComparisonHistory
);

documentComparisonRouter.get(
  '/:comparisonId',
  authenticateJWT,
  getComparisonResult
);