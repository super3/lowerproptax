import express from 'express';
import * as mailController from '../controllers/mailController.js';

const router = express.Router();

// Public routes (no auth required) — these serve the direct mail landing pages
router.get('/mail/r/:code', mailController.getRecipientByCode);
router.post('/mail/r/:code/checkout', mailController.createCheckout);

export default router;
