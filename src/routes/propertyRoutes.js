import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as propertyController from '../controllers/propertyController.js';

const router = express.Router();

// Public routes (no auth required)
router.post('/properties/scrape-preview', propertyController.scrapePreview);

// Authenticated property routes
router.get('/properties', requireAuth, propertyController.getProperties);
router.get('/properties/:id', requireAuth, propertyController.getProperty);
router.post('/properties', requireAuth, propertyController.createProperty);
router.put('/properties/:id', requireAuth, propertyController.updateProperty);
router.delete('/properties/:id', requireAuth, propertyController.deleteProperty);

export default router;
