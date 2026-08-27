import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { TourStatus } from '../../../contract/api';
import { TourCoreFields } from './tour-core.schema';

/** One departure: a route, on a date, in a vehicle, with a guide. */
@Schema({ collection: 'tours', timestamps: true })
export class Tour extends TourCoreFields {
  @Prop({ type: Date, required: true, index: true }) startsAt!: Date;
  @Prop({ type: Date, required: true }) endsAt!: Date;
  @Prop({ type: String, enum: ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'], default: 'DRAFT', index: true })
  status!: TourStatus;
  @Prop({ type: Types.ObjectId }) templateId?: Types.ObjectId;
  /** Snapshot of the vehicle's seat count at creation; the seat map itself is read live. */
  @Prop({ type: Number, required: true }) seatCount!: number;
  @Prop({ type: Date }) publishedAt?: Date;
  @Prop({ type: Date }) cancelledAt?: Date;
  @Prop({ type: String }) cancellationReason?: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export type TourDocument = HydratedDocument<Tour>;
export const TourSchema = SchemaFactory.createForClass(Tour);
TourSchema.index({ status: 1, startsAt: 1 });

/** A saved set of tour settings: "same thing again, different date or guide". */
@Schema({ collection: 'tour_templates', timestamps: true })
export class TourTemplate extends TourCoreFields {
  @Prop({ type: String, required: true, trim: true }) name!: string;
  @Prop({ type: String, default: '09:00' }) defaultStartTime!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export type TourTemplateDocument = HydratedDocument<TourTemplate>;
export const TourTemplateSchema = SchemaFactory.createForClass(TourTemplate);
