import { Module } from '@nestjs/common';

import { WebSocketModule } from '../websocket/websocket.module';
import { HealthCheckService } from './health.service';

@Module({
  imports: [WebSocketModule],
  providers: [HealthCheckService],
  exports: [HealthCheckService],
})
export class HealthModule {}
