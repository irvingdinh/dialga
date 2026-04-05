import { Module } from '@nestjs/common';

import { WebSocketModule } from '../websocket/websocket.module';
import { FilesystemService } from './filesystem.service';

@Module({
  imports: [WebSocketModule],
  providers: [FilesystemService],
})
export class FilesystemModule {}
