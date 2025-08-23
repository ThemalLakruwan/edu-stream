import mongoose, { Document, Schema } from 'mongoose';

export interface ILesson {
  id: string;
  title: string;
  videoUrl: string;
  duration: number;
  order: number;
  description?: string;
  resources?: string[];
}

export interface ICourse extends Document {
  title: string;
  description: string;
  instructor: {
    id: string;
    name: string;
    avatar: string;
  };
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  thumbnail: string;
  videoUrl: string;
  materials: string[];
  lessons: ILesson[];
  requirements: string[];
  tags: string[];
  rating: number;
  ratingCount: number;
  enrolledCount: number;
  price: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LessonSchema: Schema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  videoUrl: { type: String, required: true },
  duration: { type: Number, required: true },
  order: { type: Number, required: true },
  description: String,
  resources: [String]
});

const CourseSchema: Schema = new Schema({
  title: { type: String, required: true, index: true },
  description: { type: String, required: true },
  instructor: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    avatar: String
  },
  category: { type: String, required: true, index: true },
  difficulty: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'], 
    required: true 
  },
  duration: { type: Number, required: true },
  thumbnail: { type: String, required: true },
  videoUrl: String,
  materials: [String],
  lessons: [LessonSchema],
  requirements: [String],
  tags: [{ type: String, index: true }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0 },
  enrolledCount: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: false }
}, {
  timestamps: true
});

CourseSchema.index({ title: 'text', description: 'text', tags: 'text' });
CourseSchema.index({ category: 1, difficulty: 1 });
CourseSchema.index({ rating: -1, enrolledCount: -1 });
CourseSchema.index({ createdAt: -1 });

export const Course = mongoose.model<ICourse>('Course', CourseSchema);