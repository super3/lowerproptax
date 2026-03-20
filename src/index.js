import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { clerkMiddleware } from '@clerk/express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
import adminRoutes from './routes/adminRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import mailRoutes from './routes/mailRoutes.js';
import { handleWebhook } from './controllers/mailController.js';
import { initDatabase } from './db/init.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - override allowed origins via CORS_ORIGINS env var (comma-separated)
const defaultOrigins = ['https://lowerproptax.com', 'https://super3.github.io', 'http://localhost:8000'];
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : defaultOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
};

// Middleware
app.use(cors(corsOptions));

// Serve static files (HTML, CSS, JS) from public directory — before auth middleware
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Stripe webhook needs raw body - must be before express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json());

// Clerk middleware for authentication
app.use(clerkMiddleware());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'LowerPropTax server is running' });
});

// Homepage
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: PUBLIC_DIR });
});

// Referral landing page - serves static HTML, data loaded via API
app.get('/r/:code', (req, res) => {
  res.sendFile('report.html', { root: PUBLIC_DIR });
});

// Success page after payment
app.get('/r/:code/success', (req, res) => {
  res.sendFile('report-success.html', { root: PUBLIC_DIR });
});

// API routes
app.use('/api', adminRoutes);
app.use('/api', campaignRoutes);
app.use('/api', mailRoutes);

// Catch-all: serve index.html for any unmatched non-API routes
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: PUBLIC_DIR });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`LowerPropTax server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
