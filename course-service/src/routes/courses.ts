// course-service/src/routes/courses.ts
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

/** ---------- PUBLIC LIST (published only) ---------- */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = { isPublished: true };

    if (req.query.category) filter.category = req.query.category;
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;

    if (req.query.q || req.query.search) {
      const searchTerm = (req.query.q || req.query.search) as string;
      filter.$text = { $search: searchTerm };
    }

    let sort: any = { createdAt: -1 };
    if (req.query.sortBy === 'rating') sort = { rating: -1, ratingCount: -1 };
    else if (req.query.sortBy === 'popular') sort = { enrolledCount: -1 };

    const [courses, total] = await Promise.all([
      Course.find(filter).sort(sort).skip(skip).limit(limit).select('-lessons.videoUrl').lean(),
      Course.countDocuments(filter)
    ]);

    return res.json({
      courses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get courses error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** ---------- ADMIN/INSTRUCTOR LIST (includes drafts) ---------- */
router.get('/admin', verifyToken, requireRole(['instructor','admin']), async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const includeDrafts = (req.query.includeDrafts ?? 'true') !== 'false';
    const owner = (req.query.owner as string) || 'all'; // 'all' | 'me'
    const q = (req.query.q as string) || '';

    const filter: any = {};
    if (!includeDrafts) filter.isPublished = true;
    if (owner === 'me' && req.userRole === 'instructor') {
      filter['instructor.id'] = req.userId;
    }
    if (q) filter.$text = { $search: q };

    let sort: any = { createdAt: -1 };
    if (req.query.sortBy === 'rating') sort = { rating: -1, ratingCount: -1 };
    else if (req.query.sortBy === 'popular') sort = { enrolledCount: -1 };

    const [items, total] = await Promise.all([
      Course.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Course.countDocuments(filter)
    ]);

    return res.json({
      courses: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Admin list courses error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** ---------- GET BY ID (published only) ---------- */
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!course.isPublished) return res.status(404).json({ error: 'Course not available' });

    const publicCourse = {
      ...course,
      lessons: course.lessons?.map(l => ({ ...l, videoUrl: undefined })),
    };
    return res.json(publicCourse);
  } catch (error) {
    console.error('Get course error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** ---------- VALIDATORS ---------- */
const allowedDifficulties = new Set(['beginner','intermediate','advanced']);
function validateCreate(body: any) {
  const errors: string[] = [];
  if (!body.title || String(body.title).trim().length < 3) errors.push('Title is required (min 3 chars)');
  if (!body.description || String(body.description).trim().length < 10) errors.push('Description is required (min 10 chars)');
  if (!body.category) errors.push('Category is required');
  if (!body.difficulty || !allowedDifficulties.has(String(body.difficulty))) errors.push('Difficulty must be beginer/intermediate/advanced');
  const dur = Number(body.duration);
  if (!Number.isFinite(dur) || dur <= 0) errors.push('Duration must be a positive number');
  const price = Number(body.price ?? 0);
  if (!Number.isFinite(price) || price < 0) errors.push('Price must be a non-negative number');
  return errors;
}

/** ---------- CREATE (instructor/admin) ---------- */
router.post(
  '/',
  verifyToken,
  requireRole(['instructor', 'admin']),
  upload.single('thumbnail'),
  async (req, res) => {
    try {
      const authReq = req as AuthRequest;

      // Basic validation
      const errors = validateCreate(req.body);
      if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

      const {
        title, description, category, difficulty, duration, materials, lessons, requirements, tags, price,
      } = req.body;

      let thumbnailUrl = '';
      if (req.file) {
        thumbnailUrl = await uploadFile(req.file, 'course-thumbnails');
      }

      const course = new Course({
        title: String(title).trim(),
        description: String(description).trim(),
        instructor: {
          id: authReq.userId!,
          name: authReq.userName || authReq.userEmail || 'Unknown',     // ✅ proper name
          avatar: '', // optional: expand later
        },
        category: String(category).trim(),
        difficulty,
        duration: Number(duration),
        thumbnail: thumbnailUrl,
        materials: materials ? JSON.parse(materials) : [],
        lessons: lessons ? JSON.parse(lessons) : [],
        requirements: requirements ? JSON.parse(requirements) : [],
        tags: tags ? JSON.parse(tags) : [],
        price: Number(price) || 0,
        isPublished: false, // drafts by default
      });

      await course.save();

      // increment category count if exists (no-op if not found)
      await Category.findOneAndUpdate({ name: course.category }, { $inc: { courseCount: 1 } }).catch(() => {});

      await publishEvent('course.created', {
        courseId: course._id,
        instructorId: authReq.userId,
        title: course.title,
      });

      return res.status(201).json({ message: 'Course created successfully', course });
    } catch (error: any) {
      // Multer file size limit
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Thumbnail too large. Max 100MB' });
      }
      console.error('Create course error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** ---------- UPDATE / DELETE / PUBLISH / UNPUBLISH (unchanged except messages) ---------- */
router.put('/:id', verifyToken, requireRole(['instructor', 'admin']), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.instructor.id !== authReq.userId && authReq.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    Object.assign(course, req.body);
    await course.save();
    return res.json({ message: 'Course updated successfully', course });
  } catch (error) {
    console.error('Update course error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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
    await Category.findOneAndUpdate({ name: course.category }, { $inc: { courseCount: -1 } }).catch(() => {});
    return res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/publish', verifyToken, requireRole(['instructor', 'admin']), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.instructor.id !== authReq.userId && authReq.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    course.isPublished = true;
    await course.save();
    await publishEvent('course.published', { courseId: course._id, instructorId: course.instructor.id, title: course.title });
    return res.json({ message: 'Course published', course });
  } catch (error) {
    console.error('Publish course error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/unpublish', verifyToken, requireRole(['instructor', 'admin']), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.instructor.id !== authReq.userId && authReq.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    course.isPublished = false;
    await course.save();
    return res.json({ message: 'Course unpublished', course });
  } catch (error) {
    console.error('Unpublish course error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
