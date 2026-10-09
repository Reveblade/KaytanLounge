import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PERMISSIONS, type Permission, type RoleTier } from '../../../contract/api';

@Schema({ collection: 'admin_roles', timestamps: true })
export class AdminRole {
  @Prop({ type: String, required: true, unique: true, trim: true })
  key!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String, enum: ['OWNER', 'FULL', 'STANDARD'], default: 'STANDARD' })
  tier!: RoleTier;

  @Prop({ type: [String], enum: PERMISSIONS, default: [] })
  permissions!: Permission[];

  /** Owner and Full Access: not editable, not deletable. */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type AdminRoleDocument = HydratedDocument<AdminRole>;
export const AdminRoleSchema = SchemaFactory.createForClass(AdminRole);
