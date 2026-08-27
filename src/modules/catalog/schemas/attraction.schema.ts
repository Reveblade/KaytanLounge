import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  GeoPointDocument,
  GeoPointSchema,
  LocalizedTextDocument,
  LocalizedTextSchema,
  MediaItemDocument,
  MediaItemSchema,
} from '../../../common/schema/shared.schema';
import { ATTRACTION_TYPES, type AttractionType, type PublishStatus } from '../../../contract/api';

@Schema({ collection: 'attractions', timestamps: true })
export class Attraction {
  @Prop({ type: String, required: true, unique: true, trim: true })
  slug!: string;

  @Prop({ type: String, enum: ATTRACTION_TYPES, required: true, index: true })
  type!: AttractionType;

  @Prop({ type: LocalizedTextSchema, required: true })
  name!: LocalizedTextDocument;

  @Prop({ type: LocalizedTextSchema, default: {} })
  summary!: LocalizedTextDocument;

  @Prop({ type: LocalizedTextSchema, default: {} })
  description!: LocalizedTextDocument;

  @Prop({ type: LocalizedTextSchema })
  tips?: LocalizedTextDocument;

  @Prop({ type: String, required: true, trim: true, index: true })
  district!: string;

  @Prop({ type: String, trim: true })
  address?: string;

  @Prop({ type: GeoPointSchema, required: true })
  location!: GeoPointDocument;

  @Prop({ type: String })
  openingHours?: string;

  @Prop({ type: LocalizedTextSchema })
  ticket?: LocalizedTextDocument;

  @Prop({ type: Number, default: 60, min: 5 })
  visitMinutes!: number;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: [MediaItemSchema], default: [] })
  media!: MediaItemDocument[];

  @Prop({ type: Boolean, default: false, index: true })
  featured!: boolean;

  @Prop({ type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT', index: true })
  status!: PublishStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type AttractionDocument = HydratedDocument<Attraction>;
export const AttractionSchema = SchemaFactory.createForClass(Attraction);
