import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminsController } from './controllers/admins.controller';
import { RolesController } from './controllers/roles.controller';
import { Admin, AdminSchema } from './schemas/admin.schema';
import { AdminRole, AdminRoleSchema } from './schemas/admin-role.schema';
import { AdminSession, AdminSessionSchema } from './schemas/admin-session.schema';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminService } from './services/admin.service';
import { RoleService } from './services/role.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: AdminRole.name, schema: AdminRoleSchema },
      { name: AdminSession.name, schema: AdminSessionSchema },
    ]),
    AuditModule,
  ],
  controllers: [AdminAuthController, AdminsController, RolesController],
  providers: [AdminService, RoleService, AdminAuthService],
  exports: [AdminService, RoleService],
})
export class IamModule {}
