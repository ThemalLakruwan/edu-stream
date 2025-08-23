import express from 'express';
import { Course } from '../models/Course';
import { Category } from '../models/Category';
import { verifyToken, AuthRequest, requireRole } from '../middleware/auth';
import { uploadFile, deleteFile } from '../services/fileService';
import { publishEvent } from '../services/eventService';
import multer from 'multer';
import mongoose from 'mongoose';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Get all courses with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = { isPublished: true };
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }
    
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
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
      .select('-lessons.videoUrl') // Hide lesson videos for non-enrolled users
      .lean();

    const total = await Course.countDocuments(filter);

    res.json({
      courses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get course by ID
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).lean();
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!course.isPublished) {
      return res.status(404).json({ error: 'Course not available' });
    }

    // Hide lesson video URLs for non-enrolled users
    // This would need enrollment check in real implementation
    const publicCourse = {
      ...course,
      lessons: course.lessons.map(lesson => ({
        ...lesson,
        videoUrl: undefined // Hide video URL
      }))
    };

    res.json(publicCourse);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get course content (requires enrollment)
router.get('/:id/content', verifyToken, async (req: AuthRequest, res) => {
  try {
    // TODO: Check if user is enrolled in the course
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error('Get course content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new course (instructors only)
router.post('/', verifyToken, requireRole(['instructor', 'admin']), upload.single('thumbnail'), async (req: AuthRequest, res) => {
  try {
    const { title, description, category, difficulty, requirements, tags, price } = req.body;
    
    let thumbnailUrl = '';
    if (req.file) {
      thumbnailUrl = await uploadFile(req.file, 'thumbnails');
    }

    const course = new Course({
      title,
      description,
      instructor: {
        id: req.userId!,
        name: req.body.instructorName,
        avatar: req.body.instructorAvatar
      },
      category,
      difficulty,
      thumbnail: thumbnailUrl,
      requirements: JSON.parse(requirements || '[]'),
      tags: JSON.parse(tags || '[]'),
      price: parseFloat(price) || 0,
      duration: 0,
      lessons: [],
      materials: []
    });

    await course.save();

    // Update category course count
    await Category.findOneAndUpdate(
      { name: category },
      { $inc: { courseCount: 1 } }
    );

    // Publish course created event
    await publishEvent('course.created', {
      courseId: course._id,
      instructorId: req.userId,
      title: course.title
    });

    res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update course
router.put('/:id', verifyToken, requireRole(['instructor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if user is the course instructor or admin
    if (course.instructor.id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this course' });
    }

    const allowedFields = ['title', 'description', 'category', 'difficulty', 'requirements', 'tags', 'price'];
    const updates: any = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json(updatedCourse);
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add lesson to course
router.post('/:id/lessons', verifyToken, requireRole(['instructor', 'admin']), upload.single('video'), async (req: AuthRequest, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.instructor.id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let videoUrl = '';
    if (req.file) {
      videoUrl = await uploadFile(req.file, 'videos');
    }

    const lesson = {
      id: new mongoose.Types.ObjectId().toString(),
      title: req.body.title,
      videoUrl,
      duration: parseInt(req.body.duration) || 0,
      order: course.lessons.length + 1,
      description: req.body.description
    };

    course.lessons.push(lesson);
    course.duration += lesson.duration;
    await course.save();

    res.status(201).json(lesson);
  } catch (error) {
    console.error('Add lesson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete course
router.delete('/:id', verifyToken, requireRole(['instructor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.instructor.id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete associated files
    if (course.thumbnail) {
      await deleteFile(course.thumbnail);
    }

    for (const lesson of course.lessons) {
      if (lesson.videoUrl) {
        await deleteFile(lesson.videoUrl);
      }
    }

    await Course.findByIdAndDelete(req.params.id);

    // Update category course count
    await Category.findOneAndUpdate(
      { name: course.category },
      { $inc: { courseCount: -1 } }
    );

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;