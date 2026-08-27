import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Realms, RequirePermissions } from '../../../common/auth/auth.decorators';
import { PaginationQueryDto } from '../../../common/dto/common.dto';
import type { AdminCustomerDto } from '../../../contract/api';
import { CustomerNotesDto } from '../dto/customer.dto';
import { CustomerService } from '../services/customer.service';

@ApiTags('admin/customers')
@Controller('admin/customers')
@Realms('ADMIN')
export class AdminCustomersController {
  constructor(private readonly customers: CustomerService) {}

  @Get()
  @RequirePermissions('CUSTOMERS_READ')
  list(@Query() query: PaginationQueryDto) {
    return this.customers.list(query);
  }

  @Get(':id')
  @RequirePermissions('CUSTOMERS_READ')
  async get(@Param('id') id: string): Promise<AdminCustomerDto> {
    return this.customers.toDto(await this.customers.getById(id), { adminNotes: true });
  }

  @Patch(':id/notes')
  @RequirePermissions('CUSTOMERS_WRITE')
  async notes(@Param('id') id: string, @Body() dto: CustomerNotesDto): Promise<AdminCustomerDto> {
    return this.customers.toDto(await this.customers.updateNotes(id, dto.adminNotes), { adminNotes: true });
  }
}
