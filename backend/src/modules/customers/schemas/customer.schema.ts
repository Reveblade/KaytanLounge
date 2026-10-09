import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LOCALES, type Locale } from '../../../contract/api';

/**
 * Local mirror of a Kuwho consumer account. Kuwho owns identity (phone, email, social);
 * this record owns what the tour product needs: a stable id for bookings and a cached
 * profile so lists render without a network call.
 */
@Schema({ collection: 'customers', timestamps: true })
export class Customer {
  @Prop({ type: String, required: true, unique: true })
  kuwhoCustomerId!: string;

  @Prop({ type: String, required: true, trim: true })
  displayName!: string;

  @Prop({ type: String, trim: true })
  firstName?: string;

  @Prop({ type: String, trim: true })
  lastName?: string;

  @Prop({ type: String, index: true })
  phone?: string;

  @Prop({ type: Boolean, default: false })
  phoneVerified!: boolean;

  @Prop({ type: String, index: true })
  email?: string;

  @Prop({ type: Boolean, default: false })
  emailVerified!: boolean;

  @Prop({ type: String })
  avatarUrl?: string;

  @Prop({ type: String, enum: LOCALES, default: 'en' })
  preferredLocale!: Locale;

  @Prop({ type: Date })
  lastSeenAt?: Date;

  /** Internal notes written by support staff. Never sent to the customer. */
  @Prop({ type: String })
  adminNotes?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type CustomerDocument = HydratedDocument<Customer>;
export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ displayName: 'text', phone: 'text', email: 'text' });
