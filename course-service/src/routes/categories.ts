import express from 'express';
import { Category } from '../models/Category';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).lean();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category (admin only)
router.post('/', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    
    const category = new Category({
      name,
      description,
      icon
    });

    await category.save();
    res.status(201).json(category);
  } catch (error: any) {
    console.error('Create category error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;