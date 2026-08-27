import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor, Realms, RequirePermissions, type RequestActor } from '../../common/auth/auth.decorators';
import { ForbiddenActionException } from '../../common/exceptions/domain.exception';
import { AuditModule } from '../audit/audit.module';
import { Booking, BookingSchema } from '../bookings/booking.schema';
import { FleetModule } from '../fleet/fleet.module';
import { GuidesModule } from '../guides/guides.module';
import { RoutesModule } from '../routes/routes.module';
import {
  CreateFromTemplateDto,
  CreateTemplateDto,
  CreateTourDto,
  DuplicateTourDto,
  SaveTemplateDto,
  TourQueryDto,
  TourStatusDto,
  UpdateTemplateDto,
  UpdateTourDto,
} from './dto/tour.dto';
import { Tour, TourSchema, TourTemplate, TourTemplateSchema } from './schemas/tour.schema';
import { SeatAvailabilityService } from './seat-availability.service';
import { TourService } from './tour.service';

@ApiTags('admin/tours')
@Controller('admin/tours')
@Realms('ADMIN')
class AdminToursController {
  constructor(private readonly tours: TourService) {}

  @Get()
  @RequirePermissions('TOURS_READ')
  list(@CurrentActor() actor: RequestActor, @Query() query: TourQueryDto) {
    // Guides only ever see their own calendar.
    const scoped = actor.roleKey === 'tour_guide' && !actor.isOwner ? { ...query, mine: true } : query;
    return this.tours.list(actor, scoped);
  }

  @Get(':id')
  @RequirePermissions('TOURS_READ')
  async get(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    const detail = await this.tours.getDetail(id);
    if (actor.roleKey === 'tour_guide' && !actor.isOwner && detail.guideId !== actor.guideId) {
      throw new ForbiddenActionException('NOT_YOUR_TOUR', 'This departure is led by another guide');
    }
    return detail;
  }

  @Post()
  @RequirePermissions('TOURS_WRITE')
  async create(@CurrentActor() actor: RequestActor, @Body() dto: CreateTourDto) {
    if (dto.status === 'PUBLISHED' && !actor.isOwner && !actor.permissions.includes('TOURS_PUBLISH')) {
      throw new ForbiddenActionException('PERMISSION_DENIED', 'Missing permission: TOURS_PUBLISH');
    }
    return this.tours.toDto(await this.tours.create(actor, dto));
  }

  @Patch(':id')
  @RequirePermissions('TOURS_WRITE')
  async update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdateTourDto) {
    return this.tours.toDto(await this.tours.update(actor, id, dto));
  }

  @Post(':id/status')
  @RequirePermissions('TOURS_PUBLISH')
  @HttpCode(HttpStatus.OK)
  async setStatus(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: TourStatusDto) {
    return this.tours.toDto(await this.tours.setStatus(actor, id, dto.status, dto.reason));
  }

  @Post(':id/duplicate')
  @RequirePermissions('TOURS_WRITE')
  async duplicate(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: DuplicateTourDto) {
    return this.tours.toDto(await this.tours.duplicate(actor, id, dto));
  }

  @Post(':id/save-template')
  @RequirePermissions('TOURS_WRITE')
  async saveTemplate(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: SaveTemplateDto) {
    return this.tours.templateToDto(await this.tours.saveAsTemplate(actor, id, dto));
  }

  @Delete(':id')
  @RequirePermissions('TOURS_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.tours.remove(actor, id);
  }
}

@ApiTags('admin/tour-templates')
@Controller('admin/tour-templates')
@Realms('ADMIN')
class AdminTourTemplatesController {
  constructor(private readonly tours: TourService) {}

  @Get()
  @RequirePermissions('TOURS_READ')
  list() {
    return this.tours.listTemplates();
  }

  @Get(':id')
  @RequirePermissions('TOURS_READ')
  async get(@Param('id') id: string) {
    return this.tours.templateToDto(await this.tours.getTemplate(id));
  }

  @Post()
  @RequirePermissions('TOURS_WRITE')
  async create(@CurrentActor() actor: RequestActor, @Body() dto: CreateTemplateDto) {
    return this.tours.templateToDto(await this.tours.createTemplate(actor, dto));
  }

  @Post('instantiate')
  @RequirePermissions('TOURS_WRITE')
  async instantiate(@CurrentActor() actor: RequestActor, @Body() dto: CreateFromTemplateDto) {
    if (dto.status === 'PUBLISHED' && !actor.isOwner && !actor.permissions.includes('TOURS_PUBLISH')) {
      throw new ForbiddenActionException('PERMISSION_DENIED', 'Missing permission: TOURS_PUBLISH');
    }
    const { created, skipped } = await this.tours.createFromTemplate(actor, dto);
    return { created: created.map((t) => this.tours.toDto(t)), skipped };
  }

  @Patch(':id')
  @RequirePermissions('TOURS_WRITE')
  async update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.tours.templateToDto(await this.tours.updateTemplate(actor, id, dto));
  }

  @Delete(':id')
  @RequirePermissions('TOURS_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.tours.removeTemplate(actor, id);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tour.name, schema: TourSchema },
      { name: TourTemplate.name, schema: TourTemplateSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    RoutesModule,
    FleetModule,
    GuidesModule,
    AuditModule,
  ],
  controllers: [AdminToursController, AdminTourTemplatesController],
  providers: [TourService, SeatAvailabilityService],
  exports: [TourService, SeatAvailabilityService, MongooseModule],
})
export class ToursModule {}
