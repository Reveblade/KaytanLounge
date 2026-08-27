import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  GeoPointDocument,
  GeoPointSchema,
  LocalizedListDocument,
  LocalizedListSchema,
  LocalizedTextDocument,
  LocalizedTextSchema,
  MediaItemDocument,
  MediaItemSchema,
} from '../../../common/schema/shared.schema';
import {
  BUSINESS_CATEGORIES,
  SPONSOR_TIERS,
  type BusinessCategory,
  type PublishStatus,
  type SponsorTier,
} from '../../../contract/api';

@Schema({ _id: false })
export class BusinessContactDocument {
  @Prop({ type: String }) phone?: string;
  @Prop({ type: String }) whatsapp?: string;
  @Prop({ type: String }) instagram?: string;
  @Prop({ type: String }) website?: string;
  @Prop({ type: String }) email?: string;
}
export const BusinessContactSchema = SchemaFactory.createForClass(BusinessContactDocument);

/** A partner venue that appears as a route node and is advertised across the product. */
@Schema({ collection: 'businesses', timestamps: true })
export class Business {
  @Prop({ type: String, required: true, unique: true, trim: true })
  slug!: string;

  @Prop({ type: String, enum: BUSINESS_CATEGORIES, required: true })
  category!: BusinessCategory;

  @Prop({ type: String, enum: SPONSOR_TIERS, default: 'STANDARD', index: true })
  sponsorTier!: SponsorTier;

  @Prop({ type: LocalizedTextSchema, required: true })
  name!: LocalizedTextDocument;

  @Prop({ type: LocalizedTextSchema, default: {} })
  summary!: LocalizedTextDocument;

  @Prop({ type: LocalizedTextSchema, default: {} })
  description!: LocalizedTextDocument;

  @Prop({ type: String, required: true, trim: true })
  district!: string;

  @Prop({ type: String, trim: true })
  address?: string;

  @Prop({ type: GeoPointSchema, required: true })
  location!: GeoPointDocument;

  @Prop({ type: BusinessContactSchema, default: {} })
  contact!: BusinessContactDocument;

  @Prop({ type: String })
  openingHours?: string;

  @Prop({ type: [String], default: [] })
  cuisine!: string[];

  @Prop({ type: LocalizedListSchema, default: {} })
  features!: LocalizedListDocument;

  @Prop({ type: LocalizedTextSchema })
  offer?: LocalizedTextDocument;

  @Prop({ type: Number, default: 90, min: 5 })
  visitMinutes!: number;

  @Prop({ type: [MediaItemSchema], default: [] })
  media!: MediaItemDocument[];

  @Prop({ type: MediaItemSchema })
  logo?: MediaItemDocument;

  @Prop({ type: Boolean, default: false, index: true })
  featured!: boolean;

  @Prop({ type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT', index: true })
  status!: PublishStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type BusinessDocument = HydratedDocument<Business>;
export const BusinessSchema = SchemaFactory.createForClass(Business);
