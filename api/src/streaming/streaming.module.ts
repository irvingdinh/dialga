import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { StreamingController } from './streaming.controller.js';
import { StreamingService } from './streaming.service.js';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [StreamingController],
  providers: [StreamingService],
  exports: [StreamingService],
})
export class StreamingModule {}
