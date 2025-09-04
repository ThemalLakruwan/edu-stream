// auth-service/src/index.ts - FIXED VERSION
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { User, IUser } from './models/User';
import authRoutes from './routes/auth';
import { connectDB } from './config/database';
import { redisClient } from './config/redis';
import { requireRole } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ TRUST PROXY: we’re behind nginx (single hop)
app.set('trust proxy', 1);   // or true

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // keyGenerator not strictly required now that trust proxy is set,
  // but safe to keep explicit:
  // keyGenerator: (req, _res) => req.ip
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ADMIN_SEED: Set<string> = new Set(
  (process.env.ADMIN_SEED_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
);

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: "/api/auth/google/callback"
}, async (_accessToken, _refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) return done(new Error('Email not found from Google'), false);

    // Try by googleId or email (so a pre-created admin by email gets linked)
    let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });

    if (!user) {
      user = await User.create({
        googleId: profile.id,
        email,
        name: profile.displayName,
        avatar: profile.photos?.[0]?.value,
        role: ADMIN_SEED.has(email) ? 'admin' : 'student'
      });
    } else {
      if (!user.googleId || user.googleId === '') user.googleId = profile.id;
      user.name = user.name || profile.displayName;
      user.avatar = user.avatar || profile.photos?.[0]?.value;
      try {
        await user.save();
      } catch (e: any) {
        // handle E11000 nicely
        if (e?.code === 11000) {
          console.error('Duplicate key while linking googleId:', e?.keyValue);
          return done(new Error('Account linking conflict'), false);
        }
        return done(e, false);
      }
    }

    return done(null, user);
  } catch (error) {
    console.error('Google strategy error:', error);
    return done(error, false);
  }
}));

app.use(passport.initialize());

// Routes
app.use('/', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint for API Gateway discovery
app.get('/', (req, res) => {
  res.json({
    message: "EduStream Auth Service",
    endpoints: {
      "google_auth": "/google",
      "callback": "/google/callback",
      "me": "/me",
      "logout": "/logout",
      "refresh": "/refresh"
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Auth service error:', err.stack);
  res.status(500).json({ error: 'Authentication service error' });
});

// Start server
async function startServer() {
  try {
    await connectDB();
    await redisClient.connect();

    app.listen(PORT, () => {
      console.log(`Auth service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();