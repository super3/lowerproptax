import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAuthOrApiKey } from '../middleware/apiKeyAuth.js';
import * as adminController from '../controllers/adminController.js';
import { addClient } from '../services/sseManager.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// SSE event stream - accepts either Clerk JWT (with admin role) or API key
router.get('/admin/events', requireAuthOrApiKey, (req, res) => {
  addClient(req, res);
});

// Admin routes - allow both Clerk admin auth and API key auth
router.get('/admin/pending-properties', requireAuthOrApiKey, adminController.getPendingProperties);
router.get('/admin/completed-properties', requireAuthOrApiKey, adminController.getCompletedProperties);
router.get('/admin/properties/:id', requireAuthOrApiKey, adminController.getPropertyDetails);
router.put('/admin/properties/:id', requireAuthOrApiKey, adminController.updatePropertyDetails);

// Direct mail routes
router.post('/admin/upload-mailed-properties', requireAuthOrApiKey, upload.single('file'), adminController.uploadMailedProperties);
router.get('/admin/mailed-properties', requireAuthOrApiKey, adminController.getMailedProperties);

// Public referral route (no auth required)
router.get('/referral/:code', adminController.trackReferralVisit);

export default router;
