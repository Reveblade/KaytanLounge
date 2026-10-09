import { Controller, Get, Module, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Realms, RequirePermissions } from '../../common/auth/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/common.dto';
import { AuditLog, AuditLogSchema } from './audit-log.schema';
import { AuditService } from './audit.service';

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() resourceType?: string;
  @IsOptional() @IsString() resourceId?: string;
  @IsOptional() @IsString() actorId?: string;
}

@ApiTags('admin/audit')
@Controller('admin/audit')
@Realms('ADMIN')
class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('AUDIT_READ')
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
