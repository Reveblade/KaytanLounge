import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CustomerSession } from '../../modules/customers/schemas/customer-session.schema';
import { AdminSession } from '../../modules/iam/schemas/admin-session.schema';
import { isObjectId } from '../utils/mongo';
import type { AccessClaims } from './token.service';

/**
 * Access JWTs are otherwise valid until they expire. Logout and reuse detection
 * only stamp the session document, so every authenticated request re-checks it.
 */
@Injectable()
export class SessionAccessService {
  constructor(
    @InjectModel(CustomerSession.name) private readonly customerSessions: Model<CustomerSession>,
    @InjectModel(AdminSession.name) private readonly adminSessions: Model<AdminSession>,
  ) {}

  async isLive(claims: AccessClaims): Promise<boolean> {
    if (!isObjectId(claims.sessionId) || !isObjectId(claims.sub)) return false;
    const id = new Types.ObjectId(claims.sessionId);
    const now = new Date();
    if (claims.realm === 'CUSTOMER') {
      const session = await this.customerSessions.findById(id).select('revokedAt expiresAt customerId').lean();
      return Boolean(
        session && !session.revokedAt && session.expiresAt > now && String(session.customerId) === claims.sub,
      );
    }
    if (claims.realm === 'ADMIN') {
      const session = await this.adminSessions.findById(id).select('revokedAt expiresAt adminId').lean();
      return Boolean(session && !session.revokedAt && session.expiresAt > now && String(session.adminId) === claims.sub);
    }
    return false;
  }
}
