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

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport configuration - FIXED callback URL
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  // This should match your API gateway routing
  callbackURL: "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      return done(null, user);
    } else {
      user = await User.create({
        googleId: profile.id,
        email: profile.emails?.[0].value,
        name: profile.displayName,
        avatar: profile.photos?.[0].value,
        role: 'student'
      });
      return done(null, user);
    }
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