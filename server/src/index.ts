import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { config } from './config';
import { setupSocket } from './socket';
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaign';
import mapRoutes from './routes/map';
import tokenRoutes from './routes/token';
import characterRoutes from './routes/character';
import combatRoutes from './routes/combat';
import spellRoutes from './routes/spell';
import equipmentRoutes from './routes/equipment';
import uploadRoutes from './routes/upload';
import { errorHandler } from './middleware/errorHandler';
import { globalLimiter, authLimiter } from './middleware/rateLimiter';
import { sanitizeBody } from './middleware/sanitize';
import { logger } from './utils/logger';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());
app.use(sanitizeBody);
app.use(globalLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Serve client static files in production
if (config.nodeEnv === 'production') {
  // __dirname = server/dist/server/src/ due to rootDir:".."
  // Go up 4 levels to project root, then client/dist
  const clientDist = path.resolve(__dirname, '../../../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback: redirect all non-API routes to index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/combat', combatRoutes);
app.use('/api/spells', spellRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(errorHandler);

// Socket.IO
const io = setupSocket(httpServer);

// Start
httpServer.listen(config.port, () => {
  logger.info('Server started', { port: config.port, env: config.nodeEnv });
});

export { app, httpServer, io };
