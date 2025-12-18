import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as propertyController from '../controllers/propertyController.js';

const router = express.Router();

// All property routes require authentication
router.get('/properties', requireAuth, propertyController.getProperties as express.RequestHandler);
router.get('/properties/:id', requireAuth, propertyController.getProperty as express.RequestHandler);
router.post('/properties', requireAuth, propertyController.createProperty as express.RequestHandler);
router.put('/properties/:id', requireAuth, propertyController.updateProperty as express.RequestHandler);
router.delete('/properties/:id', requireAuth, propertyController.deleteProperty as express.RequestHandler);

export default router;
