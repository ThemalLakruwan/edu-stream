import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { verifyToken, AuthRequest, requireRole } from '../middleware/auth';
import { redisClient } from '../config/redis';

const router = express.Router();

// Google OAuth routes - Fixed the callback URL issue
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`
  }),
  async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        console.error('No user in callback');
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
      }

      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      // Store token in Redis for session management
      await redisClient.setEx(`session:${user._id}`, 24 * 60 * 60, token);

      // Redirect to frontend with token - This is the key fix
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/success?token=${encodeURIComponent(token)}`;
      console.log('Redirecting to:', redirectUrl);
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }
  }
);

// Get current user
router.get('/me', verifyToken, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select('-googleId');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', verifyToken, async (req: AuthRequest, res) => {
  try {
    // Remove session from Redis
    await redisClient.del(`session:${req.userId}`);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', verifyToken, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newToken = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Update session in Redis
    await redisClient.setEx(`session:${user._id}`, 24 * 60 * 60, newToken);

    res.json({ token: newToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all admins (paginated)
router.get('/admins', verifyToken, requireRole(['admin']), async (req, res) => {
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '20');
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    User.find({ role: 'admin' }).select('_id email name avatar role createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments({ role: 'admin' })
  ]);

  res.json({ admins: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// Grant admin to email (creates stub user if not exists)
router.post('/admins/grant', verifyToken, requireRole(['admin']), async (req, res) => {
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email is required' });

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, name: email.split('@')[0], role: 'admin' }); // <- no googleId here
  } else if (user.role !== 'admin') {
    user.role = 'admin';
    await user.save();
  }
  res.json({ message: 'Granted admin', user: { _id: user._id, email: user.email, role: user.role } });
});

// Revoke admin (prevent removing last admin)
router.post('/admins/revoke', verifyToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  const { userId } = req.body as { userId: string };
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const target = await User.findById(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role !== 'admin') return res.status(400).json({ error: 'User is not an admin' });

  const adminCount = await User.countDocuments({ role: 'admin' });
  if (adminCount <= 1 && target._id.equals(userId)) {
    return res.status(400).json({ error: 'Cannot revoke the last admin' });
  }
  // Also block self-demotion leaving zero admins
  if (adminCount <= 1 && target._id.equals(req.userId)) {
    return res.status(400).json({ error: 'Cannot revoke yourself as the last admin' });
  }

  target.role = 'student';
  await target.save();
  res.json({ message: 'Revoked admin', user: { _id: target._id, email: target.email, role: target.role } });
});

// List users (paginated, for admin dashboard)
router.get('/users', verifyToken, requireRole(['admin']), async (req, res) => {
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '20');
  const q = (req.query.q as string)?.trim();
  const filter: any = {};
  if (q) filter.$or = [{ email: new RegExp(q, 'i') }, { name: new RegExp(q, 'i') }];

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter).select('_id email name avatar role createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter)
  ]);
  res.json({ users: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export default router;