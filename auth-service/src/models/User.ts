import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'student' | 'instructor' | 'admin';
  subscriptions: Array<{
    planId: string;
    status: 'active' | 'cancelled' | 'expired';
    startDate: Date;
    endDate: Date;
    stripeSubscriptionId: string;
  }>;
  preferences: any;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  avatar: { type: String },
  role: { 
    type: String, 
    enum: ['student', 'instructor', 'admin'], 
    default: 'student' 
  },
  subscriptions: [{
    planId: String,
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired'],
      default: 'active'
    },
    startDate: Date,
    endDate: Date,
    stripeSubscriptionId: String
  }],
  preferences: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

UserSchema.index({ email: 1 });
UserSchema.index({ googleId: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);