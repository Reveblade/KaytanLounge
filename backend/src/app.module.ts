import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthCoreModule } from './common/auth/auth-core.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import configuration, { type DatabaseConfig } from './config/configuration';
import { AuditModule } from './modules/audit/audit.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomersModule } from './modules/customers/customers.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { GuidesModule } from './modules/guides/guides.module';
import { HealthController } from './modules/health/health.controller';
import { IamModule } from './modules/iam/iam.module';
import { MediaModule } from './modules/media/media.module';
import { PublicModule } from './modules/public/public.module';
import { RoutesModule } from './modules/routes/routes.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ToursModule } from './modules/tours/tours.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], envFilePath: ['.env.local', '.env'] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        return {
          uri: db.uri,
          dbName: db.dbName,
          autoIndex: process.env.NODE_ENV !== 'production',
          serverSelectionTimeoutMS: 8_000,
        };
      },
    }),
    ScheduleModule.forRoot(),
    AuthCoreModule,
    AuditModule,
    IamModule,
    CustomersModule,
    CatalogModule,
    RoutesModule,
    FleetModule,
    GuidesModule,
    ToursModule,
    BookingsModule,
    SettingsModule,
    MediaModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
