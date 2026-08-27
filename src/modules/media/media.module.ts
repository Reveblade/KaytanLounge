import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import {
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { v2 as cloudinary } from 'cloudinary';
import type { Response } from 'express';
import sharp from 'sharp';
import { Public, Realms, RequirePermissions } from '../../common/auth/auth.decorators';
import { DomainException } from '../../common/exceptions/domain.exception';
import type { AppConfig, MediaConfig } from '../../config/configuration';
import type { MediaItem } from '../../contract/api';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Uploads go to Cloudinary when it is configured, otherwise to a local folder that this
 * API serves. Images are re-encoded to WebP and capped at 2400px; a 640px thumbnail
 * accompanies every image so lists never download hero-sized files.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly config: MediaConfig;
  private readonly publicOrigin: string;
  private readonly apiPath: string;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<MediaConfig>('media');
    const app = configService.getOrThrow<AppConfig>('app');
    this.publicOrigin = app.publicOrigin.replace(/\/$/, '');
    this.apiPath = `/${app.apiPrefix}/${app.apiVersion}`;
    if (this.config.cloudinary) {
      cloudinary.config({
        cloud_name: this.config.cloudinary.cloudName,
        api_key: this.config.cloudinary.apiKey,
        api_secret: this.config.cloudinary.apiSecret,
        secure: true,
      });
    }
  }

  get provider(): 'CLOUDINARY' | 'LOCAL' {
    return this.config.cloudinary ? 'CLOUDINARY' : 'LOCAL';
  }

  async upload(file: Express.Multer.File, folder = 'uploads'): Promise<Omit<MediaItem, 'id'>> {
    if (file.size > this.config.maxFileBytes) {
      throw new DomainException('FILE_TOO_LARGE', `Files are limited to ${Math.round(this.config.maxFileBytes / 1_048_576)} MB`, 413);
    }
    if (IMAGE_TYPES.has(file.mimetype)) return this.uploadImage(file.buffer, folder);
    if (VIDEO_TYPES.has(file.mimetype)) return this.uploadVideo(file, folder);
    throw new DomainException('UNSUPPORTED_MEDIA', 'Upload a JPEG, PNG, WebP, GIF, AVIF, MP4 or WebM file', 415);
  }

  /** Re-hosts a file already on disk (brand assets shipped with the repo). */
  async importFromFile(path: string, folder = 'imports'): Promise<Omit<MediaItem, 'id'> | undefined> {
    try {
      return await this.uploadImage(await readFile(path), folder);
    } catch (error) {
      this.logger.warn(`import failed for ${path}: ${String(error)}`);
      return undefined;
    }
  }

  /**
   * Pulls a licensed photo in and re-hosts it. Wikimedia requires a descriptive
   * User-Agent with a contact address and rate limits hard, so failures are retried
   * with a backoff rather than dropped.
   */
  async importFromUrl(url: string, folder = 'imports'): Promise<Omit<MediaItem, 'id'> | undefined> {
    const userAgent =
      process.env.MEDIA_IMPORT_USER_AGENT ??
      'BaskaIstanbulYokBot/1.0 (https://baskaistanbulyok.com; hello@baskaistanbulyok.com) media-import';
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const response = await fetch(url, { headers: { 'user-agent': userAgent, accept: 'image/*' } });
        if (response.status === 429 || response.status >= 500) {
          await delay(1500 * 2 ** attempt);
          continue;
        }
        if (!response.ok) {
          this.logger.warn(`import ${response.status} for ${url}`);
          return undefined;
        }
        const type = response.headers.get('content-type') ?? '';
        if (!type.startsWith('image/')) return undefined;
        return await this.uploadImage(Buffer.from(await response.arrayBuffer()), folder);
      } catch (error) {
        if (attempt === 3) {
          this.logger.warn(`import failed for ${url}: ${String(error)}`);
          return undefined;
        }
        await delay(1500 * 2 ** attempt);
      }
    }
    return undefined;
  }

  private async uploadImage(input: Buffer, folder: string): Promise<Omit<MediaItem, 'id'>> {
    const base = sharp(input, { failOn: 'none' }).rotate();
    const meta = await base.metadata();
    const full = await base.clone().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
    const thumb = await base.clone().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const name = this.fileName(full.data);

    if (this.config.cloudinary) {
      const publicId = `${this.config.cloudinary.folder}/${folder}/${name}`;
      const uploaded = await this.cloudinaryUpload(full.data, publicId, 'image');
      return {
        kind: 'IMAGE',
        url: uploaded.secure_url,
        thumbnailUrl: cloudinary.url(uploaded.public_id, { secure: true, width: 640, crop: 'limit', fetch_format: 'auto', quality: 'auto' }),
        provider: 'CLOUDINARY',
        publicId: uploaded.public_id,
        width: full.info.width,
        height: full.info.height,
      };
    }

    await this.writeLocal(`${name}.webp`, full.data);
    await this.writeLocal(`${name}.thumb.webp`, thumb);
    return {
      kind: 'IMAGE',
      url: this.localUrl(`${name}.webp`),
      thumbnailUrl: this.localUrl(`${name}.thumb.webp`),
      provider: 'LOCAL',
      publicId: name,
      width: full.info.width ?? meta.width,
      height: full.info.height ?? meta.height,
    };
  }

  private async uploadVideo(file: Express.Multer.File, folder: string): Promise<Omit<MediaItem, 'id'>> {
    const name = this.fileName(file.buffer);
    if (this.config.cloudinary) {
      const publicId = `${this.config.cloudinary.folder}/${folder}/${name}`;
      const uploaded = await this.cloudinaryUpload(file.buffer, publicId, 'video');
      return {
        kind: 'VIDEO',
        url: uploaded.secure_url,
        thumbnailUrl: cloudinary.url(uploaded.public_id, { secure: true, resource_type: 'video', format: 'jpg', width: 960, crop: 'limit' }),
        provider: 'CLOUDINARY',
        publicId: uploaded.public_id,
      };
    }
    const ext = extname(file.originalname || '.mp4') || '.mp4';
    await this.writeLocal(`${name}${ext}`, file.buffer);
    return { kind: 'VIDEO', url: this.localUrl(`${name}${ext}`), provider: 'LOCAL', publicId: name };
  }

  private cloudinaryUpload(buffer: Buffer, publicId: string, resourceType: 'image' | 'video') {
    return new Promise<{ secure_url: string; public_id: string }>((resolvePromise, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: resourceType, overwrite: true },
        (error, result) => {
          // Cloudinary hands back a plain response object, not an Error, so it is wrapped.
          if (error || !result) return reject(error instanceof Error ? error : new Error(error?.message ?? 'Cloudinary returned no result'));
          resolvePromise({ secure_url: result.secure_url, public_id: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  private fileName(buffer: Buffer): string {
    return `${createHash('sha1').update(buffer).digest('hex').slice(0, 16)}${randomBytes(3).toString('hex')}`;
  }

  private async writeLocal(name: string, data: Buffer): Promise<void> {
    const dir = resolve(this.config.localDir);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), data);
  }

  private localUrl(name: string): string {
    return `${this.publicOrigin}${this.apiPath}/media/files/${name}`;
  }

  localPath(name: string): string | undefined {
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) return undefined;
    const path = join(resolve(this.config.localDir), name);
    return existsSync(path) ? path : undefined;
  }
}

@ApiTags('media')
@Controller('media')
class MediaController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @Get('files/:name')
  serve(@Param('name') name: string, @Res() res: Response) {
    const path = this.media.localPath(name);
    if (!path) throw new NotFoundException();
    const type = name.endsWith('.webp') ? 'image/webp' : name.endsWith('.mp4') ? 'video/mp4' : name.endsWith('.webm') ? 'video/webm' : 'application/octet-stream';
    res.setHeader('content-type', type);
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    createReadStream(path).pipe(res);
  }
}

@ApiTags('admin/media')
@Controller('admin/media')
@Realms('ADMIN')
class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @RequirePermissions('MEDIA_WRITE')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 64 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Query('folder') folder?: string) {
    if (!file) throw new DomainException('FILE_REQUIRED', 'Attach a file under the "file" field', 400);
    return this.media.upload(file, (folder ?? 'uploads').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'uploads');
  }
}

@Module({
  controllers: [MediaController, AdminMediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
