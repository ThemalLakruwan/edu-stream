import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  userId: string;
  subscriptionId?: string;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'requires_action';
  description: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  subscriptionId: { type: String, index: true },
  stripePaymentIntentId: { type: String, required: true, unique: true },
  stripeChargeId: String,
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'usd' },
  status: { 
    type: String, 
    enum: ['succeeded', 'failed', 'pending', 'requires_action'], 
    required: true 
  },
  description: String,
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);