import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  LOCALES,
  PAYMENT_PROVIDERS,
  PRICE_TIER_KEYS,
  type BookingStatus,
  type CurrencyCode,
  type Locale,
  type PaymentProvider,
  type PaymentStatus,
  type PriceTierKey,
} from '../../contract/api';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['PENDING_PAYMENT', 'AWAITING_APPROVAL', 'CONFIRMED'];

@Schema({ _id: false })
export class BookingPassengerDocument {
  @Prop({ type: String, required: true }) seatLabel!: string;
  @Prop({ type: String, required: true, trim: true }) fullName!: string;
  @Prop({ type: String, enum: PRICE_TIER_KEYS, required: true }) tierKey!: PriceTierKey;
  @Prop({ type: Number, required: true }) amount!: number;
  @Prop({ type: Date }) checkedInAt?: Date;
}
export const BookingPassengerSchema = SchemaFactory.createForClass(BookingPassengerDocument);

@Schema({ _id: false })
export class BookingPaymentDocument {
  @Prop({ type: String, enum: PAYMENT_PROVIDERS, required: true }) provider!: PaymentProvider;
  @Prop({ type: String, enum: ['UNPAID', 'PENDING', 'PAID', 'REFUNDED', 'FAILED'], default: 'UNPAID' })
  status!: PaymentStatus;
  @Prop({ type: String }) reference?: string;
  @Prop({ type: Types.ObjectId }) approvedByAdminId?: Types.ObjectId;
  @Prop({ type: Date }) approvedAt?: Date;
  @Prop({ type: Date }) refundedAt?: Date;
  @Prop({ type: Number }) refundAmount?: number;
  @Prop({ type: String }) note?: string;
}
export const BookingPaymentSchema = SchemaFactory.createForClass(BookingPaymentDocument);

@Schema({ _id: false })
export class BookingContactDocument {
  @Prop({ type: String, required: true, trim: true }) fullName!: string;
  @Prop({ type: String, required: true, trim: true }) phone!: string;
  @Prop({ type: String, trim: true, lowercase: true }) email?: string;
}
export const BookingContactSchema = SchemaFactory.createForClass(BookingContactDocument);

@Schema({ collection: 'bookings', timestamps: true })
export class Booking {
  @Prop({ type: String, required: true, unique: true }) ticketCode!: string;
  @Prop({ type: Types.ObjectId, index: true }) customerId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, index: true }) tourId!: Types.ObjectId;
  @Prop({
    type: String,
    enum: ['PENDING_PAYMENT', 'AWAITING_APPROVAL', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'EXPIRED'],
    default: 'AWAITING_APPROVAL',
    index: true,
  })
  status!: BookingStatus;
  @Prop({ type: [BookingPassengerSchema], default: [] }) passengers!: BookingPassengerDocument[];
  @Prop({ type: BookingContactSchema, required: true }) contact!: BookingContactDocument;
  @Prop({ type: Number, required: true }) subtotal!: number;
  @Prop({ type: Number, default: 0 }) discount!: number;
  @Prop({ type: Number, required: true }) total!: number;
  @Prop({ type: String, enum: ['TRY', 'EUR', 'USD', 'GBP'], required: true }) currency!: CurrencyCode;
  @Prop({ type: BookingPaymentSchema, required: true }) payment!: BookingPaymentDocument;
  @Prop({ type: String, enum: LOCALES, default: 'en' }) locale!: Locale;
  @Prop({ type: String }) notes?: string;
  @Prop({ type: Date, index: true }) holdExpiresAt?: Date;
  @Prop({ type: Date }) confirmedAt?: Date;
  @Prop({ type: Date }) cancelledAt?: Date;
  @Prop({ type: String }) cancellationReason?: string;
  @Prop({ type: Types.ObjectId }) createdByAdminId?: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;
}

export type BookingDocument = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);
BookingSchema.index({ tourId: 1, status: 1 });
BookingSchema.index({ 'contact.phone': 1 });
