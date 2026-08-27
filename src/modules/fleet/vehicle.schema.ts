import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  LocalizedTextDocument,
  LocalizedTextSchema,
  MediaItemDocument,
  MediaItemSchema,
} from '../../common/schema/shared.schema';
import type { SeatCellKind, VehicleStatus, VehicleType } from '../../contract/api';

@Schema({ _id: false })
export class SeatCellDocument {
  @Prop({ type: Number, required: true }) row!: number;
  @Prop({ type: Number, required: true }) col!: number;
  @Prop({ type: String, enum: ['SEAT', 'DRIVER', 'GUIDE', 'AISLE', 'EMPTY', 'DOOR', 'TABLE'], required: true })
  kind!: SeatCellKind;
  @Prop({ type: String }) label?: string;
  @Prop({ type: Boolean }) premium?: boolean;
}
export const SeatCellSchema = SchemaFactory.createForClass(SeatCellDocument);

@Schema({ _id: false })
export class SeatMapDocument {
  @Prop({ type: Number, required: true }) rows!: number;
  @Prop({ type: Number, required: true }) cols!: number;
  @Prop({ type: [SeatCellSchema], default: [] }) cells!: SeatCellDocument[];
}
export const SeatMapSchema = SchemaFactory.createForClass(SeatMapDocument);

@Schema({ collection: 'vehicles', timestamps: true })
export class Vehicle {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: ['MINIBUS', 'BUS', 'VAN', 'BOAT', 'YACHT', 'CAR'], required: true })
  type!: VehicleType;

  @Prop({ type: String, trim: true }) make?: string;
  @Prop({ type: String, trim: true }) model?: string;
  @Prop({ type: Number }) year?: number;
  @Prop({ type: String, trim: true }) plate?: string;

  @Prop({ type: SeatMapSchema, required: true })
  seatMap!: SeatMapDocument;

  @Prop({ type: Number, required: true })
  seatCount!: number;

  @Prop({ type: [String], default: [] })
  amenities!: string[];

  @Prop({ type: LocalizedTextSchema, default: {} })
  description!: LocalizedTextDocument;

  @Prop({ type: [MediaItemSchema], default: [] })
  media!: MediaItemDocument[];

  @Prop({ type: String, enum: ['ACTIVE', 'MAINTENANCE', 'RETIRED'], default: 'ACTIVE', index: true })
  status!: VehicleStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type VehicleDocument = HydratedDocument<Vehicle>;
export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
