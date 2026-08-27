import { Types } from 'mongoose';
import { DomainException } from '../exceptions/domain.exception';

export function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && Types.ObjectId.isValid(value) && String(new Types.ObjectId(value)) === value;
}

export function toObjectId(value: string, label = 'id'): Types.ObjectId {
  if (!isObjectId(value)) {
    throw new DomainException('INVALID_ID', `${label} is not a valid identifier`, 400, { value });
  }
  return new Types.ObjectId(value);
}

export function idOf(doc: { _id: Types.ObjectId | string } | Types.ObjectId | string): string {
  if (typeof doc === 'string') return doc;
  if (doc instanceof Types.ObjectId) return doc.toString();
  return String(doc._id);
}

/** Case-insensitive "contains" for search boxes, with regex characters escaped. */
export function containsRegex(q: string): RegExp {
  return new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

export function iso(value: Date | undefined | null): string | undefined {
  return value ? value.toISOString() : undefined;
}
