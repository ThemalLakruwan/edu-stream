// course-service/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  userName?: string;         
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const base = (process.env.AUTH_SERVICE_URL || 'http://auth-service:3001').replace(/\/+$/,'');
    const response = await axios.get(`${base}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });

    req.userId = response.data._id;
    req.userEmail = response.data.email;
    req.userRole = response.data.role;
    req.userName = response.data.name || ''; 

    next();
  } catch (error: any) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error('Token verification error:', status, data);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
