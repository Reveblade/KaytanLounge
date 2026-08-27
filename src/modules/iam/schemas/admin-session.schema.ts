import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** One signed-in device. Refresh rotates the hash; logout sets `revokedAt`. */
@Schema({ collection: 'admin_sessions', timestamps: true })
export class AdminSession {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  adminId!: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  refreshHash!: string;

  @Prop({ type: Number, default: 0 })
  sessionVersion!: number;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date })
  revokedAt?: Date;

  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: String })
  ip?: string;

  @Prop({ type: Date })
  lastSeenAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type AdminSessionDocument = HydratedDocument<AdminSession>;
export const AdminSessionSchema = SchemaFactory.createForClass(AdminSession);
