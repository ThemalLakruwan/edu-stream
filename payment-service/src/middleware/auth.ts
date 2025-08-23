import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify JWT directly (same as auth service)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { 
      userId: string; 
      role: string; 
      email: string; 
    };

    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userRole = payload.role;
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};