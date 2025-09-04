// course-service/src/models/Enrollment.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IEnrollment extends Document {
  userId: string;
  courseId: string;
  enrolledAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollment>({
  userId: { type: String, required: true, index: true },
  courseId: { type: String, required: true, index: true },
  enrolledAt: { type: Date, default: Date.now }
}, { timestamps: true });

EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const Enrollment = mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema);
