import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { AdminAttractionsController, AdminBusinessesController } from './catalog.controller';
import { Attraction, AttractionSchema } from './schemas/attraction.schema';
import { Business, BusinessSchema } from './schemas/business.schema';
import { AttractionService } from './services/attraction.service';
import { BusinessService } from './services/business.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attraction.name, schema: AttractionSchema },
      { name: Business.name, schema: BusinessSchema },
    ]),
    AuditModule,
  ],
  controllers: [AdminAttractionsController, AdminBusinessesController],
  providers: [AttractionService, BusinessService],
  exports: [AttractionService, BusinessService],
})
export class CatalogModule {}
