// course-service/src/routes/enrollments.ts
import express from 'express';
import { verifyToken, AuthRequest, requireRole } from '../middleware/auth';
import { Enrollment } from '../models/Enrollment';
import { Course } from '../models/Course';

const router = express.Router();

// Enroll current user to a course
router.post('/:courseId/enroll', verifyToken, async (req: AuthRequest, res) => {
  const courseId = req.params.courseId;
  const userId = req.userId!;
  const course = await Course.findById(courseId).lean();
  if (!course || !course.isPublished) return res.status(404).json({ error: 'Course not found' });

  try {
    const doc = await Enrollment.create({ userId, courseId });
    // Optional: keep Course.enrolledCount in sync
    await Course.updateOne({ _id: courseId }, { $inc: { enrolledCount: 1 } }).catch(() => {});
    res.status(201).json(doc);
  } catch (e: any) {
    if (e.code === 11000) return res.status(200).json({ message: 'Already enrolled' });
    throw e;
  }
});

// Unenroll current user
router.delete('/:courseId/enroll', verifyToken, async (req: AuthRequest, res) => {
  const { deletedCount } = await Enrollment.deleteOne({ userId: req.userId!, courseId: req.params.courseId });
  if (deletedCount > 0) {
    await Course.updateOne({ _id: req.params.courseId }, { $inc: { enrolledCount: -1 } }).catch(() => {});
  }
  res.json({ success: true });
});

// My enrolled courses (returns course docs)
router.get('/me', verifyToken, async (req: AuthRequest, res) => {
  const enrolls = await Enrollment.find({ userId: req.userId! }).select('courseId enrolledAt').lean();
  const ids = enrolls.map(e => e.courseId);
  const courses = ids.length ? await Course.find({ _id: { $in: ids } }).select('title thumbnail category difficulty duration instructor').lean() : [];
  const byId = new Map(courses.map(c => [String(c._id), c]));
  const result = enrolls.map(e => ({ enrolledAt: e.enrolledAt, course: byId.get(e.courseId) })).filter(x => x.course);
  res.json(result);
});

// Admin summary: enrolled counts per course
router.get('/summary', verifyToken, requireRole(['admin']), async (_req, res) => {
  const agg = await Enrollment.aggregate([
    { $group: { _id: '$courseId', count: { $sum: 1 } } },
    { $addFields: { courseIdObj: { $toObjectId: '$_id' } } },
    { $lookup: { from: 'courses', localField: 'courseIdObj', foreignField: '_id', as: 'course' } },
    { $unwind: '$course' },
    { $project: { courseId: '$course._id', count: 1, title: '$course.title', category: '$course.category', difficulty: '$course.difficulty', createdAt: '$course.createdAt' } },
    { $sort: { count: -1, createdAt: -1 } }
  ]);
  return res.json(agg);
});

export default router;
