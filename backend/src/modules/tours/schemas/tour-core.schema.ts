import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  GeoPointDocument,
  GeoPointSchema,
  LocalizedListDocument,
  LocalizedListSchema,
  LocalizedTextDocument,
  LocalizedTextSchema,
} from '../../../common/schema/shared.schema';
import { PRICE_TIER_KEYS, type CurrencyCode, type PriceTierKey } from '../../../contract/api';

@Schema({ _id: false })
export class PriceTierDocument {
  @Prop({ type: String, enum: PRICE_TIER_KEYS, required: true }) key!: PriceTierKey;
  @Prop({ type: LocalizedTextSchema, default: {} }) label!: LocalizedTextDocument;
  @Prop({ type: Number, required: true, min: 0 }) amount!: number;
  @Prop({ type: Number }) minAge?: number;
  @Prop({ type: Number }) maxAge?: number;
}
export const PriceTierSchema = SchemaFactory.createForClass(PriceTierDocument);

@Schema({ _id: false })
export class TourPricingDocument {
  @Prop({ type: String, enum: ['TRY', 'EUR', 'USD', 'GBP'], default: 'EUR' }) currency!: CurrencyCode;
  @Prop({ type: [PriceTierSchema], default: [] }) tiers!: PriceTierDocument[];
  @Prop({ type: Number, default: 0, min: 0 }) premiumSeatSurcharge!: number;
}
export const TourPricingSchema = SchemaFactory.createForClass(TourPricingDocument);

@Schema({ _id: false })
export class MeetingPointDocument {
  @Prop({ type: LocalizedTextSchema, default: {} }) name!: LocalizedTextDocument;
  @Prop({ type: String }) address?: string;
  @Prop({ type: GeoPointSchema, required: true }) location!: GeoPointDocument;
  @Prop({ type: LocalizedTextSchema }) instructions?: LocalizedTextDocument;
}
export const MeetingPointSchema = SchemaFactory.createForClass(MeetingPointDocument);

/** Fields a departure and a reusable template have in common. */
export class TourCoreFields {
  @Prop({ type: Types.ObjectId, required: true, index: true }) routeId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, index: true }) vehicleId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, index: true }) guideId!: Types.ObjectId;
  @Prop({ type: MeetingPointSchema, required: true }) meetingPoint!: MeetingPointDocument;
  @Prop({ type: [String], default: ['en'] }) languages!: string[];
  @Prop({ type: TourPricingSchema, required: true }) pricing!: TourPricingDocument;
  @Prop({ type: LocalizedListSchema, default: {} }) inclusions!: LocalizedListDocument;
  @Prop({ type: LocalizedListSchema, default: {} }) exclusions!: LocalizedListDocument;
  @Prop({ type: String, required: true }) contactPhone!: string;
  @Prop({ type: String }) whatsapp?: string;
  @Prop({ type: LocalizedTextSchema, default: {} }) cancellationPolicy!: LocalizedTextDocument;
  @Prop({ type: [String], default: [] }) blockedSeats!: string[];
  @Prop({ type: Number }) minPassengers?: number;
  @Prop({ type: Number }) durationMinutes?: number;
  @Prop({ type: String }) internalNotes?: string;
}
