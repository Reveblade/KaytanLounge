import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { RequestActor } from '../../common/auth/auth.decorators';
import type { AuditLogDto, Paginated } from '../../contract/api';
import { AuditLog } from './audit-log.schema';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectModel(AuditLog.name) private readonly logs: Model<AuditLog>) {}

  /** Never throws: an audit failure must not roll back the action it describes. */
  async record(
    actor: RequestActor | undefined,
    action: string,
    resourceType: string,
    resourceId?: string,
    summary?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.logs.create({
        actorId: actor && Types.ObjectId.isValid(actor.id) ? new Types.ObjectId(actor.id) : undefined,
        actorName: actor?.displayName,
        action,
        resourceType,
        resourceId,
        summary,
        metadata,
      });
    } catch (error) {
      this.logger.warn(`audit write failed for ${action}: ${String(error)}`);
    }
  }

  async list(query: { page?: number; pageSize?: number; resourceType?: string; resourceId?: string; actorId?: string }): Promise<Paginated<AuditLogDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const filter: Record<string, unknown> = {};
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.resourceId) filter.resourceId = query.resourceId;
    if (query.actorId && Types.ObjectId.isValid(query.actorId)) filter.actorId = new Types.ObjectId(query.actorId);
    const [items, total] = await Promise.all([
      this.logs.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.logs.countDocuments(filter),
    ]);
    return {
      items: items.map((l) => ({
        id: String(l._id),
        actorId: l.actorId ? String(l.actorId) : undefined,
        actorName: l.actorName,
        action: l.action,
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        summary: l.summary,
        metadata: l.metadata,
        createdAt: l.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
