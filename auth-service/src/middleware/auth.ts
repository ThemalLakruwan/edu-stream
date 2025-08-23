// auth-service/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redisClient } from '../config/redis';

export interface AuthRequest extends Request {
  userId?: string;
  role?: string;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; role: string; email: string };

    // Optional but recommended: ensure session isn’t revoked in Redis
    const sessionKey = `session:${payload.userId}`;
    const storedToken = await redisClient.get(sessionKey);
    if (!storedToken) {
      return res.status(401).json({ error: 'Session expired' });
    }

    // (If you rotate tokens, do NOT require equality with storedToken; existence is enough.)
    req.userId = payload.userId;
    req.role = payload.role;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
