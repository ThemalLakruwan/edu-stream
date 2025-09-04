// course-service/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import courseRoutes from './routes/courses';
import categoryRoutes from './routes/categories';
import enrollmentsRoutes from './routes/enrollments';
import { connectDB } from './config/database';

const app = express();
const PORT = process.env.PORT || 3002;

/** ✅ Trust Nginx proxy so express-rate-limit accepts X-Forwarded-For */
app.set('trust proxy', 1); // or true

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

/** ✅ Rate limit (safe with proxy) */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  // keyGenerator: (req) => req.ip, // uses trusted proxy chain
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/courses', courseRoutes);
app.use('/categories', categoryRoutes);
app.use('/enrollments', enrollmentsRoutes);

// Health
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'course-service',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.stack || err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Course service running on port ${PORT}`);
      console.log('Available routes:');
      console.log('  GET /courses - Get all courses');
      console.log('  GET /courses/:id - Get course by ID');
      console.log('  GET /categories - Get all categories');
      console.log('  GET /health - Health check');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
