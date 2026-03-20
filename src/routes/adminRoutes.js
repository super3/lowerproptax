import express from 'express';
import multer from 'multer';
import { requireAuthOrApiKey } from '../middleware/apiKeyAuth.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Admin routes - allow both Clerk admin auth and API key auth
router.get('/admin/pending-properties', requireAuthOrApiKey, adminController.getPendingProperties);
router.get('/admin/completed-properties', requireAuthOrApiKey, adminController.getCompletedProperties);
router.get('/admin/properties/:id', requireAuthOrApiKey, adminController.getPropertyDetails);
router.put('/admin/properties/:id', requireAuthOrApiKey, adminController.updatePropertyDetails);

// Direct mail routes
router.post('/admin/upload-mailed-properties', requireAuthOrApiKey, upload.single('file'), adminController.uploadMailedProperties);
router.get('/admin/mailed-properties', requireAuthOrApiKey, adminController.getMailedProperties);

export default router;
