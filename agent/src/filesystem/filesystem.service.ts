import fs from 'node:fs';
import path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { WebSocketService } from '../websocket/websocket.service';

interface FsListRequest {
  request_id: string;
  path: string;
}

interface FsMkdirRequest {
  request_id: string;
  path: string;
}

interface FsEntry {
  name: string;
  type: 'directory' | 'file';
}

@Injectable()
export class FilesystemService {
  private readonly logger = new Logger(FilesystemService.name);

  constructor(private readonly ws: WebSocketService) {}

  @OnEvent('ws.fs:list')
  handleFsList(data: FsListRequest): void {
    const dirPath = data.path || '/';

    try {
      const resolved = path.resolve(dirPath);
      const entries: FsEntry[] = [];

      const dirents = fs.readdirSync(resolved, { withFileTypes: true });
      for (const dirent of dirents) {
        // Skip hidden files/folders
        if (dirent.name.startsWith('.')) continue;

        entries.push({
          name: dirent.name,
          type: dirent.isDirectory() ? 'directory' : 'file',
        });
      }

      // Sort: directories first, then alphabetically
      entries.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      this.ws.send('fs:list:result', {
        request_id: data.request_id,
        path: resolved,
        entries,
      });
    } catch (err) {
      this.logger.warn(
        `fs:list failed for ${dirPath}: ${(err as Error).message}`,
      );
      this.ws.send('fs:list:result', {
        request_id: data.request_id,
        path: dirPath,
        entries: [],
        error: (err as Error).message,
      });
    }
  }

  @OnEvent('ws.fs:mkdir')
  handleFsMkdir(data: FsMkdirRequest): void {
    const dirPath = data.path;

    try {
      const resolved = path.resolve(dirPath);
      fs.mkdirSync(resolved, { recursive: true });

      this.ws.send('fs:mkdir:result', {
        request_id: data.request_id,
        success: true,
      });

      this.logger.log(`Created directory: ${resolved}`);
    } catch (err) {
      this.logger.warn(
        `fs:mkdir failed for ${dirPath}: ${(err as Error).message}`,
      );
      this.ws.send('fs:mkdir:result', {
        request_id: data.request_id,
        success: false,
        error: (err as Error).message,
      });
    }
  }
}
