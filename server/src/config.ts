export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://dnd:dnd@localhost:5432/dnd_visualizer',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
};
