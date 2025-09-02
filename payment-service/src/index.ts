import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import paymentRoutes from './routes/payments';
import subscriptionRoutes from './routes/subscriptions';
import webhookRoutes from './routes/webhooks';
import { connectDB } from './config/database';

const app = express();
const PORT = process.env.PORT || 3003;

// Initialize Stripe with the latest supported API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil'// Cast to any to avoid version compatibility issues
});

// Trust proxy for Docker/load balancer environments
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting - simplified configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Webhook route needs raw body
app.use('/webhooks', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/payments', paymentRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/webhooks', webhookRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'payment-service',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error stack:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Payment service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();