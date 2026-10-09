import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  GeoJsonLineStringDocument,
  GeoJsonLineStringSchema,
  LocalizedListDocument,
  LocalizedListSchema,
  LocalizedTextDocument,
  LocalizedTextSchema,
  MediaItemDocument,
  MediaItemSchema,
} from '../../../common/schema/shared.schema';
import { ROUTE_THEMES, type PublishStatus, type RouteNodeKind, type RoutePace, type RouteTheme } from '../../../contract/api';

@Schema({ _id: false })
export class RouteNodeDocument {
  @Prop({ type: String, enum: ['ATTRACTION', 'BUSINESS'], required: true })
  kind!: RouteNodeKind;

  @Prop({ type: Types.ObjectId, required: true })
  refId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  order!: number;

  @Prop({ type: Number, required: true, min: 0 })
  stayMinutes!: number;

  @Prop({ type: Number, default: 0 })
  travelMinutes!: number;

  @Prop({ type: Number, default: 0 })
  travelKm!: number;

  @Prop({ type: LocalizedTextSchema })
  note?: LocalizedTextDocument;
}
export const RouteNodeSchema = SchemaFactory.createForClass(RouteNodeDocument);

@Schema({ collection: 'routes', timestamps: true })
export class Route {
  @Prop({ type: String, required: true, unique: true, trim: true })
  slug!: string;

  @Prop({ type: LocalizedTextSchema, required: true })
  name!: LocalizedTextDocument;

  @Prop({ type: LocalizedTextSchema, default: {} })
  tagline!: LocalizedTextDocument;

  @Prop({ type: LocalizedTextSchema, default: {} })
  description!: LocalizedTextDocument;

  @Prop({ type: LocalizedListSchema, default: {} })
  highlights!: LocalizedListDocument;

  @Prop({ type: String, enum: ROUTE_THEMES, default: 'CLASSICS' })
  theme!: RouteTheme;

  @Prop({ type: String, enum: ['RELAXED', 'BALANCED', 'FULL'], default: 'BALANCED' })
  pace!: RoutePace;

  @Prop({ type: [RouteNodeSchema], default: [] })
  nodes!: RouteNodeDocument[];

  @Prop({ type: GeoJsonLineStringSchema })
  path?: GeoJsonLineStringDocument;

  @Prop({ type: Number, default: 0 })
  distanceKm!: number;

  @Prop({ type: Number, default: 0 })
  durationMinutes!: number;

  @Prop({ type: MediaItemSchema })
  cover?: MediaItemDocument;

  @Prop({ type: Boolean, default: false, index: true })
  featured!: boolean;

  @Prop({ type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT', index: true })
  status!: PublishStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type RouteDocument = HydratedDocument<Route>;
export const RouteSchema = SchemaFactory.createForClass(Route);
