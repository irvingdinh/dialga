import { Module } from '@nestjs/common';

import { WebSocketModule } from '../websocket/websocket.module';
import { GitService } from './git.service';

@Module({
  imports: [WebSocketModule],
  providers: [GitService],
})
export class GitModule {}
