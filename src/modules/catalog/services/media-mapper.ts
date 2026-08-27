import { Types } from 'mongoose';
import type { MediaItemDto } from '../../../common/dto/common.dto';
import type { MediaItemDocument } from '../../../common/schema/shared.schema';
import type { MediaItem } from '../../../contract/api';

/** Wire → document. Keeps an existing `_id` when the client sent one, so reorders are stable. */
export function mediaToDocument(items: MediaItemDto[] | undefined): MediaItemDocument[] {
  return (items ?? []).map((m) => ({
    _id: m.id && Types.ObjectId.isValid(m.id) ? new Types.ObjectId(m.id) : new Types.ObjectId(),
    kind: m.kind ?? 'IMAGE',
    url: m.url,
    thumbnailUrl: m.thumbnailUrl,
    provider: m.provider ?? 'EXTERNAL',
    publicId: m.publicId,
    width: m.width,
    height: m.height,
    alt: m.alt,
    credit: m.credit,
    license: m.license,
    sourceUrl: m.sourceUrl,
  }));
}

export function mediaToDto(item: MediaItemDocument | undefined | null): MediaItem | undefined {
  if (!item) return undefined;
  return {
    id: String(item._id),
    kind: item.kind,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    provider: item.provider,
    publicId: item.publicId,
    width: item.width,
    height: item.height,
    alt: item.alt,
    credit: item.credit,
    license: item.license,
    sourceUrl: item.sourceUrl,
  };
}

export function mediaListToDto(items: MediaItemDocument[] | undefined): MediaItem[] {
  return (items ?? []).map((m) => mediaToDto(m)!).filter(Boolean);
}
