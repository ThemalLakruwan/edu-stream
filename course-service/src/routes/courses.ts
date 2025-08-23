import express from 'express';
import { Course } from '../models/Course';
import { Category } from '../models/Category';
import { verifyToken, AuthRequest, requireRole } from '../middleware/auth';
import { uploadFile } from '../services/fileService';
import { publishEvent } from '../services/eventService';
import multer from 'multer';

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

    if (req.query.category) filter.category = req.query.category;
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;

    if (req.query.q || req.query.search) {
      const searchTerm = req.query.q || req.query.search;
      filter.$text = { $search: searchTerm };
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
      courses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
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

    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!course.isPublished)
      return res.status(404).json({ error: 'Course not available' });

    const publicCourse = {
      ...course,
      lessons: course.lessons?.map((lesson) => ({
        ...lesson,
        videoUrl: undefined,
      })),
    };

    res.json(publicCourse);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get course content (for enrolled users)
router.get('/:id/content', verifyToken, async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Course.findById(courseId).lean();

    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!course.isPublished)
      return res.status(404).json({ error: 'Course not available' });

    res.json(course);
  } catch (error) {
    console.error('Get course content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new course (instructor only)
router.post(
  '/',
  verifyToken,
  requireRole(['instructor', 'admin']),
  upload.single('thumbnail'),
  async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const {
        title,
        description,
        category,
        difficulty,
        duration,
        materials,
        lessons,
        requirements,
        tags,
        price,
      } = req.body;

      let thumbnailUrl = '';
      if (req.file) {
        thumbnailUrl = await uploadFile(req.file, 'course-thumbnails');
      }

      const course = new Course({
        title,
        description,
        instructor: {
          id: authReq.userId,
          name: authReq.userEmail, // no userName in AuthRequest
          avatar: '', // optional: fetch from auth service if needed
        },
        category,
        difficulty,
        duration: parseInt(duration),
        thumbnail: thumbnailUrl,
        materials: materials ? JSON.parse(materials) : [],
        lessons: lessons ? JSON.parse(lessons) : [],
        requirements: requirements ? JSON.parse(requirements) : [],
        tags: tags ? JSON.parse(tags) : [],
        price: parseFloat(price) || 0,
        isPublished: false,
      });

      await course.save();

      await Category.findOneAndUpdate(
        { name: category },
        { $inc: { courseCount: 1 } }
      );

      await publishEvent('course.created', {
        courseId: course._id,
        instructorId: authReq.userId,
        title: course.title,
      });

      res.status(201).json(course);
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update course
router.put('/:id', verifyToken, requireRole(['instructor', 'admin']), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const courseId = req.params.id;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (course.instructor.id !== authReq.userId && authReq.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    Object.assign(course, req.body);
    await course.save();

    res.json(course);
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete course
router.delete('/:id', verifyToken, requireRole(['instructor', 'admin']), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const courseId = req.params.id;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (course.instructor.id !== authReq.userId && authReq.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Course.findByIdAndDelete(courseId);

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

// Publish course
router.post('/:id/publish', verifyToken, requireRole(['instructor', 'admin']), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const courseId = req.params.id;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (course.instructor.id !== authReq.userId && authReq.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    course.isPublished = true;
    await course.save();

    await publishEvent('course.published', {
      courseId: course._id,
      instructorId: course.instructor.id,
      title: course.title,
    });

    res.json(course);
  } catch (error) {
    console.error('Publish course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unpublish course
router.post('/:id/unpublish', verifyToken, requireRole(['instructor', 'admin']), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const courseId = req.params.id;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (course.instructor.id !== authReq.userId && authReq.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    course.isPublished = false;
    await course.save();

    res.json(course);
  } catch (error) {
    console.error('Unpublish course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
