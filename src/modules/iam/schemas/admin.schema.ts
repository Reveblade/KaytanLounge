import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { AdminStatus } from '../../../contract/api';

@Schema({ collection: 'admins', timestamps: true })
export class Admin {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, trim: true })
  phone?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminRole', required: true, index: true })
  roleId!: Types.ObjectId;

  /** Exactly one document carries this flag. Enforced by a partial unique index. */
  @Prop({ type: Boolean, default: false })
  isOwner!: boolean;

  @Prop({ type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' })
  status!: AdminStatus;

  @Prop({ type: Types.ObjectId, ref: 'Guide' })
  guideId?: Types.ObjectId;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  /** Bumped when the password changes or the admin is suspended; older sessions die. */
  @Prop({ type: Number, default: 0 })
  sessionVersion!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type AdminDocument = HydratedDocument<Admin>;
export const AdminSchema = SchemaFactory.createForClass(Admin);
AdminSchema.index({ isOwner: 1 }, { unique: true, partialFilterExpression: { isOwner: true } });
