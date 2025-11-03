import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as propertyController from '../controllers/propertyController.js';

const router = express.Router();

// All property routes require authentication
router.get('/properties', requireAuth, propertyController.getProperties);
router.get('/properties/:id', requireAuth, propertyController.getProperty);
router.post('/properties', requireAuth, propertyController.createProperty);
router.put('/properties/:id', requireAuth, propertyController.updateProperty);
router.delete('/properties/:id', requireAuth, propertyController.deleteProperty);

export default router;
