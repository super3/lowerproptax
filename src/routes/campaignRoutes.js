import express from 'express';
import { requireAuthOrApiKey } from '../middleware/apiKeyAuth.js';
import * as campaignController from '../controllers/campaignController.js';

const router = express.Router();

// Admin campaign management routes
router.get('/admin/campaigns', requireAuthOrApiKey, campaignController.getCampaigns);
router.post('/admin/campaigns', requireAuthOrApiKey, campaignController.createCampaign);
router.get('/admin/campaigns/:id', requireAuthOrApiKey, campaignController.getCampaignDetails);
router.post('/admin/campaigns/:id/recipients', requireAuthOrApiKey, campaignController.addRecipient);
router.put('/admin/campaigns/:id/recipients/:recipientId', requireAuthOrApiKey, campaignController.updateRecipient);
router.delete('/admin/campaigns/:id/recipients/:recipientId', requireAuthOrApiKey, campaignController.deleteRecipient);

export default router;
