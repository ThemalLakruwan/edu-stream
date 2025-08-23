import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscription extends Document {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planType: 'basic' | 'premium' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  stripeCustomerId: { type: String, required: true },
  stripeSubscriptionId: { type: String, required: true, unique: true },
  planType: { 
    type: String, 
    enum: ['basic', 'premium', 'enterprise'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'past_due', 'canceled', 'unpaid', 'incomplete'], 
    required: true 
  },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  trialEnd: Date,
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);