import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { LocalizedList, LocalizedText, MediaKind, MediaProvider } from '../../contract/api';

/** Copy in up to five languages. `_id: false` keeps it a plain embedded object. */
@Schema({ _id: false })
export class LocalizedTextDocument implements LocalizedText {
  @Prop({ type: String }) tr?: string;
  @Prop({ type: String }) en?: string;
  @Prop({ type: String }) de?: string;
  @Prop({ type: String }) ru?: string;
  @Prop({ type: String }) ar?: string;
}
export const LocalizedTextSchema = SchemaFactory.createForClass(LocalizedTextDocument);

@Schema({ _id: false })
export class LocalizedListDocument implements LocalizedList {
  @Prop({ type: [String] }) tr?: string[];
  @Prop({ type: [String] }) en?: string[];
  @Prop({ type: [String] }) de?: string[];
  @Prop({ type: [String] }) ru?: string[];
  @Prop({ type: [String] }) ar?: string[];
}
export const LocalizedListSchema = SchemaFactory.createForClass(LocalizedListDocument);

@Schema({ _id: false })
export class GeoPointDocument {
  @Prop({ type: Number, required: true }) lat!: number;
  @Prop({ type: Number, required: true }) lng!: number;
}
export const GeoPointSchema = SchemaFactory.createForClass(GeoPointDocument);

/** A photo or video attached to a record. Keeps its own `_id` so clients can address it. */
@Schema({ _id: true })
export class MediaItemDocument {
  _id!: Types.ObjectId;

  @Prop({ type: String, enum: ['IMAGE', 'VIDEO'], default: 'IMAGE' })
  kind!: MediaKind;

  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String })
  thumbnailUrl?: string;

  @Prop({ type: String, enum: ['EXTERNAL', 'CLOUDINARY', 'LOCAL'], default: 'EXTERNAL' })
  provider!: MediaProvider;

  @Prop({ type: String })
  publicId?: string;

  @Prop({ type: Number })
  width?: number;

  @Prop({ type: Number })
  height?: number;

  @Prop({ type: LocalizedTextSchema })
  alt?: LocalizedTextDocument;

  @Prop({ type: String })
  credit?: string;

  @Prop({ type: String })
  license?: string;

  @Prop({ type: String })
  sourceUrl?: string;
}
export const MediaItemSchema = SchemaFactory.createForClass(MediaItemDocument);

@Schema({ _id: false })
export class GeoJsonLineStringDocument {
  @Prop({ type: String, enum: ['LineString'], default: 'LineString' })
  type!: 'LineString';

  @Prop({ type: [[Number]], default: [] })
  coordinates!: [number, number][];
}
export const GeoJsonLineStringSchema = SchemaFactory.createForClass(GeoJsonLineStringDocument);
