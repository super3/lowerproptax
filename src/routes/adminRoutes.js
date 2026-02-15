import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAuthOrApiKey } from '../middleware/apiKeyAuth.js';
import * as adminController from '../controllers/adminController.js';
import { addClient } from '../services/sseManager.js';

const router = express.Router();

// SSE event stream - accepts either Clerk JWT (with admin role) or API key
router.get('/admin/events', requireAuthOrApiKey, (req, res) => {
  addClient(req, res);
});

// Admin routes - allow both Clerk admin auth and API key auth
router.get('/admin/pending-properties', requireAuthOrApiKey, adminController.getPendingProperties);
router.get('/admin/completed-properties', requireAuthOrApiKey, adminController.getCompletedProperties);
router.get('/admin/properties/:id', requireAuthOrApiKey, adminController.getPropertyDetails);
router.put('/admin/properties/:id', requireAuthOrApiKey, adminController.updatePropertyDetails);

export default router;
