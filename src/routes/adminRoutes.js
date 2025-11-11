import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication
// TODO: Add admin role check middleware
router.get('/admin/pending-properties', requireAuth, adminController.getPendingProperties);
router.get('/admin/completed-properties', requireAuth, adminController.getCompletedProperties);
router.put('/admin/properties/:id/mark-ready', requireAuth, adminController.markPropertyAsReady);

export default router;
