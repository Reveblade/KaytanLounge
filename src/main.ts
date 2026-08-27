import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService).getOrThrow<AppConfig>('app');
  const logger = new Logger('Bootstrap');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.enableCors({ origin: config.corsOrigins.length ? config.corsOrigins : true, credentials: true });
  if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);

  app.setGlobalPrefix(config.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: config.apiVersion.replace('v', '') });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (config.nodeEnv !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('Başka İstanbul Yok API')
      .setDescription('Attractions, routes, tours, seats and bookings for the Istanbul day-tour product')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(`${config.apiPrefix}/docs`, app, SwaggerModule.createDocument(app, swagger));
  }

  await app.listen(config.port, config.host);
  logger.log(`API listening on http://${config.host}:${config.port}/${config.apiPrefix}/${config.apiVersion} (${config.nodeEnv})`);
}

void bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
