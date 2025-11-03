import express from 'express';
import cors from 'cors';
import propertyRoutes from '../../src/routes/propertyRoutes.js';

// Create a test server without starting it
export function createTestServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/api', propertyRoutes);

  // Error handling
  app.use((err, req, res, next) => {
    console.error('Test server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
