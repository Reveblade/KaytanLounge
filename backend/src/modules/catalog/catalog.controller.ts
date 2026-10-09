import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor, Realms, RequirePermissions, type RequestActor } from '../../common/auth/auth.decorators';
import {
  AttractionQueryDto,
  BusinessQueryDto,
  CreateAttractionDto,
  CreateBusinessDto,
  UpdateAttractionDto,
  UpdateBusinessDto,
} from './dto/catalog.dto';
import { AttractionService } from './services/attraction.service';
import { BusinessService } from './services/business.service';

@ApiTags('admin/attractions')
@Controller('admin/attractions')
@Realms('ADMIN')
export class AdminAttractionsController {
  constructor(private readonly attractions: AttractionService) {}

  @Get()
  @RequirePermissions('CATALOG_READ')
  list(@Query() query: AttractionQueryDto) {
    return this.attractions.list(query);
  }

  @Get(':id')
  @RequirePermissions('CATALOG_READ')
  async get(@Param('id') id: string) {
    return this.attractions.toDto(await this.attractions.getById(id));
  }

  @Post()
  @RequirePermissions('CATALOG_WRITE')
  async create(@CurrentActor() actor: RequestActor, @Body() dto: CreateAttractionDto) {
    return this.attractions.toDto(await this.attractions.create(actor, dto));
  }

  @Patch(':id')
  @RequirePermissions('CATALOG_WRITE')
  async update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdateAttractionDto) {
    return this.attractions.toDto(await this.attractions.update(actor, id, dto));
  }

  @Delete(':id')
  @RequirePermissions('CATALOG_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.attractions.remove(actor, id);
  }
}

@ApiTags('admin/businesses')
@Controller('admin/businesses')
@Realms('ADMIN')
export class AdminBusinessesController {
  constructor(private readonly businesses: BusinessService) {}

  @Get()
  @RequirePermissions('CATALOG_READ')
  list(@Query() query: BusinessQueryDto) {
    return this.businesses.list(query);
  }

  @Get(':id')
  @RequirePermissions('CATALOG_READ')
  async get(@Param('id') id: string) {
    return this.businesses.toDto(await this.businesses.getById(id));
  }

  @Post()
  @RequirePermissions('CATALOG_WRITE')
  async create(@CurrentActor() actor: RequestActor, @Body() dto: CreateBusinessDto) {
    return this.businesses.toDto(await this.businesses.create(actor, dto));
  }

  @Patch(':id')
  @RequirePermissions('CATALOG_WRITE')
  async update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businesses.toDto(await this.businesses.update(actor, id, dto));
  }

  @Delete(':id')
  @RequirePermissions('CATALOG_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.businesses.remove(actor, id);
  }
}
