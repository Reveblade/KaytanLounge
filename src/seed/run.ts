import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedRunner } from './seed.runner';

/**
 * `npm run seed` (idempotent, upserts by slug / email / name)
 * `npm run seed:reset` drops the seeded collections first.
 * `SEED_MEDIA=import npm run seed` re-hosts photos through MediaService (Cloudinary or local).
 */
async function main(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const runner = new SeedRunner(app, logger);
    await runner.run({
      reset: process.argv.includes('--reset'),
      importMedia: process.env.SEED_MEDIA === 'import',
    });
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  new Logger('Seed').error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
