import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * A customer device signed in to this product. Carries the Kuwho refresh token
 * (encrypted at rest) so the API can act on the customer's behalf at Kuwho later:
 * profile edits, attaching a phone, signing out everywhere.
 */
@Schema({ collection: 'customer_sessions', timestamps: true })
export class CustomerSession {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  refreshHash!: string;

  /** Previous refresh hash, kept so a replay after rotation can kill this session. */
  @Prop({ type: String, index: true })
  previousRefreshHash?: string;

  @Prop({ type: String })
  kuwhoRefreshTokenEnc?: string;

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

export type CustomerSessionDocument = HydratedDocument<CustomerSession>;
export const CustomerSessionSchema = SchemaFactory.createForClass(CustomerSession);
