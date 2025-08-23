// course-service/src/routes/categories.ts - COMPLETE FIXED VERSION
import express from 'express';
import { Category } from '../models/Category';
import { Course } from '../models/Course';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (!category.isActive) {
      return res.status(404).json({ error: 'Category not available' });
    }

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get courses by category
router.get('/:id/courses', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const filter: any = { 
      category: category.name,
      isPublished: true 
    };

    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }

    let sort: any = { createdAt: -1 };
    if (req.query.sortBy === 'rating') {
      sort = { rating: -1, ratingCount: -1 };
    } else if (req.query.sortBy === 'popular') {
      sort = { enrolledCount: -1 };
    }

    const courses = await Course.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-lessons.videoUrl')
      .lean();

    const total = await Course.countDocuments(filter);

    res.json({
      category,
      courses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get category courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new category (admin only)
router.post('/', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const category = new Category({
      name,
      description,
      icon,
      courseCount: 0,
      isActive: true
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category (admin only)
router.put('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const categoryId = req.params.id;
    const updates = req.body;

    const category = await Category.findByIdAndUpdate(
      categoryId,
      updates,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category (admin only)
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has courses
    const courseCount = await Course.countDocuments({ category: category.name });
    if (courseCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with existing courses' 
      });
    }

    await Category.findByIdAndDelete(categoryId);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle category active status (admin only)
router.post('/:id/toggle', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.json(category);
  } catch (error) {
    console.error('Toggle category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;