import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor, Realms, RequirePermissions, type RequestActor } from '../../common/auth/auth.decorators';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CreateRouteDto, PreviewPathDto, RouteQueryDto, UpdateRouteDto } from './dto/route.dto';
import { RouteService } from './route.service';
import { RoutingService } from './routing.service';
import { Route, RouteSchema } from './schemas/route.schema';

@ApiTags('admin/routes')
@Controller('admin/routes')
@Realms('ADMIN')
class AdminRoutesController {
  constructor(private readonly routes: RouteService) {}

  @Get()
  @RequirePermissions('ROUTES_READ')
  list(@Query() query: RouteQueryDto) {
    return this.routes.list(query);
  }

  @Get(':id')
  @RequirePermissions('ROUTES_READ')
  async get(@Param('id') id: string) {
    const route = await this.routes.getById(id);
    const places = await this.routes.resolvePlaces([route]);
    return { ...this.routes.toDto(route), resolvedNodes: this.routes.resolveNodes(route, places) };
  }

  @Post('preview')
  @RequirePermissions('ROUTES_READ')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: PreviewPathDto) {
    return this.routes.preview(dto.nodes);
  }

  @Post()
  @RequirePermissions('ROUTES_WRITE')
  async create(@CurrentActor() actor: RequestActor, @Body() dto: CreateRouteDto) {
    return this.routes.toDto(await this.routes.create(actor, dto));
  }

  @Patch(':id')
  @RequirePermissions('ROUTES_WRITE')
  async update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routes.toDto(await this.routes.update(actor, id, dto));
  }

  @Post(':id/recompute')
  @RequirePermissions('ROUTES_WRITE')
  @HttpCode(HttpStatus.OK)
  async recompute(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.routes.toDto(await this.routes.recompute(actor, id));
  }

  @Delete(':id')
  @RequirePermissions('ROUTES_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.routes.remove(actor, id);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: Route.name, schema: RouteSchema }]), CatalogModule, AuditModule],
  controllers: [AdminRoutesController],
  providers: [RouteService, RoutingService],
  exports: [RouteService, RoutingService],
})
export class RoutesModule {}
