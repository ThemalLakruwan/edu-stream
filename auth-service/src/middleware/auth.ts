// auth-service/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redisClient } from '../config/redis';

export interface AuthRequest extends Request {
  userId?: string;
  role?: 'student' | 'instructor' | 'admin';
  email?: string;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; role: AuthRequest['role']; email: string };
    const sessionKey = `session:${payload.userId}`;
    const storedToken = await redisClient.get(sessionKey);
    if (!storedToken) return res.status(401).json({ error: 'Session expired' });

    req.userId = payload.userId;
    req.role = payload.role;
    req.email = payload.email;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: AuthRequest['role'][] = ['admin']) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};