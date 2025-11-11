import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.get('/admin/pending-properties', requireAuth, requireAdmin, adminController.getPendingProperties);
router.get('/admin/completed-properties', requireAuth, requireAdmin, adminController.getCompletedProperties);
router.put('/admin/properties/:id/mark-ready', requireAuth, requireAdmin, adminController.markPropertyAsReady);

export default router;
