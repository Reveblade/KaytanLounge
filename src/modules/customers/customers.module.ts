import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminCustomersController } from './controllers/admin-customers.controller';
import { CustomerAccountController } from './controllers/customer-account.controller';
import { CustomerAuthController } from './controllers/customer-auth.controller';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { CustomerSession, CustomerSessionSchema } from './schemas/customer-session.schema';
import { CustomerAuthService } from './services/customer-auth.service';
import { CustomerService } from './services/customer.service';
import { KuwhoClient } from './services/kuwho.client';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: CustomerSession.name, schema: CustomerSessionSchema },
    ]),
  ],
  controllers: [CustomerAuthController, CustomerAccountController, AdminCustomersController],
  providers: [KuwhoClient, CustomerService, CustomerAuthService],
  exports: [CustomerService, CustomerAuthService],
})
export class CustomersModule {}
