import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor, Realms, RequirePermissions, type RequestActor } from '../../../common/auth/auth.decorators';
import { PaginationQueryDto } from '../../../common/dto/common.dto';
import { CreateAdminDto, ResetAdminPasswordDto, UpdateAdminDto } from '../dto/iam.dto';
import { AdminService } from '../services/admin.service';

@ApiTags('admin/admins')
@Controller('admin/admins')
@Realms('ADMIN')
export class AdminsController {
  constructor(private readonly admins: AdminService) {}

  @Get()
  @RequirePermissions('ADMINS_READ')
  list(@Query() query: PaginationQueryDto) {
    return this.admins.list(query);
  }

  @Get(':id')
  @RequirePermissions('ADMINS_READ')
  async get(@Param('id') id: string) {
    const { admin, role } = await this.admins.getWithRole(id);
    return this.admins.toDto(admin, role);
  }

  @Post()
  @RequirePermissions('ADMINS_WRITE')
  create(@CurrentActor() actor: RequestActor, @Body() dto: CreateAdminDto) {
    return this.admins.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions('ADMINS_WRITE')
  update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.admins.update(actor, id, dto);
  }

  @Post(':id/password')
  @RequirePermissions('ADMINS_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: ResetAdminPasswordDto) {
    return this.admins.resetPassword(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('ADMINS_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.admins.remove(actor, id);
  }
}
