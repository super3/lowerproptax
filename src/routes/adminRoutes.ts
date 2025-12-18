import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.get('/admin/pending-properties', requireAuth, requireAdmin as express.RequestHandler, adminController.getPendingProperties as express.RequestHandler);
router.get('/admin/completed-properties', requireAuth, requireAdmin as express.RequestHandler, adminController.getCompletedProperties as express.RequestHandler);
router.get('/admin/properties/:id', requireAuth, requireAdmin as express.RequestHandler, adminController.getPropertyDetails as express.RequestHandler);
router.put('/admin/properties/:id', requireAuth, requireAdmin as express.RequestHandler, adminController.updatePropertyDetails as express.RequestHandler);
router.put('/admin/properties/:id/mark-ready', requireAuth, requireAdmin as express.RequestHandler, adminController.markPropertyAsReady as express.RequestHandler);

export default router;
