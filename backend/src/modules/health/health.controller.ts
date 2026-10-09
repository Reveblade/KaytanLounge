import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Connection, ConnectionStates } from 'mongoose';
import { Public } from '../../common/auth/auth.decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  health() {
    return {
      status: this.connection.readyState === ConnectionStates.connected ? 'ok' : 'degraded',
      database: { readyState: this.connection.readyState, name: this.connection.name },
      timestamp: new Date().toISOString(),
    };
  }
}
