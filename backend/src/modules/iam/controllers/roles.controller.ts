import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor, Realms, RequirePermissions, type RequestActor } from '../../../common/auth/auth.decorators';
import { CreateRoleDto, UpdateRoleDto } from '../dto/iam.dto';
import { RoleService } from '../services/role.service';

@ApiTags('admin/roles')
@Controller('admin/roles')
@Realms('ADMIN')
export class RolesController {
  constructor(private readonly roles: RoleService) {}

  @Get()
  @RequirePermissions('ROLES_READ')
  list() {
    return this.roles.list();
  }

  @Get('permissions')
  @RequirePermissions('ROLES_READ')
  permissions() {
    return this.roles.permissionGroups();
  }

  @Post()
  @RequirePermissions('ROLES_WRITE')
  create(@CurrentActor() actor: RequestActor, @Body() dto: CreateRoleDto) {
    return this.roles.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions('ROLES_WRITE')
  update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('ROLES_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.roles.remove(actor, id);
  }
}
