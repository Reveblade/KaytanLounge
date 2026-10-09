import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RouteService } from '../modules/routes/route.service';

/**
 * `npm run routes:recompute` — re-runs the routing provider over every stored
 * route and rewrites its path, leg times and totals. Needed whenever a stop
 * moves on the map or the routing rules change; the geometry is otherwise only
 * built when a route is saved.
 */
async function main(): Promise<void> {
  const logger = new Logger('RecomputeRoutes');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const routes = app.get(RouteService, { strict: false });
    const all = await routes.list({ page: 1, pageSize: 500 });
    for (const route of all.items) {
      const before = { km: route.distanceKm, minutes: route.durationMinutes, points: route.path?.coordinates.length ?? 0 };
      const doc = await routes.recompute(undefined, route.id);
      logger.log(
        `${doc.slug}: ${before.points} -> ${doc.path?.coordinates.length ?? 0} points, ` +
          `${before.km} -> ${doc.distanceKm} km, ${before.minutes} -> ${doc.durationMinutes} min`,
      );
    }
    logger.log(`recomputed ${all.items.length} routes`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  new Logger('RecomputeRoutes').error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
