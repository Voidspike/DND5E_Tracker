import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import { setupSocket } from './socket';
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaign';
import mapRoutes from './routes/map';
import tokenRoutes from './routes/token';
import characterRoutes from './routes/character';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/characters', characterRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
const io = setupSocket(httpServer);

// Start
httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

export { app, httpServer, io };
