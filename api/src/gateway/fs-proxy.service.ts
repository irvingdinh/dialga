import { Injectable } from '@nestjs/common';

import { GatewayService } from './gateway.service.js';

@Injectable()
export class FsProxyService {
  constructor(private readonly gatewayService: GatewayService) {}

  async listDirectory(
    machineId: string,
    dirPath: string,
  ): Promise<{
    path: string;
    entries: Array<{ name: string; type: 'directory' | 'file' }>;
    error?: string;
  }> {
    const result = (await this.gatewayService.sendRequest(
      machineId,
      'fs:list',
      { path: dirPath },
    )) as {
      request_id: string;
      path: string;
      entries: Array<{ name: string; type: 'directory' | 'file' }>;
      error?: string;
    };
    return { path: result.path, entries: result.entries, error: result.error };
  }

  async mkdir(
    machineId: string,
    dirPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    const result = (await this.gatewayService.sendRequest(
      machineId,
      'fs:mkdir',
      { path: dirPath },
    )) as {
      request_id: string;
      success: boolean;
      error?: string;
    };
    return { success: result.success, error: result.error };
  }

  async readFile(
    machineId: string,
    filePath: string,
  ): Promise<{
    path: string;
    content: string | null;
    size?: number;
    error?: string;
  }> {
    const result = (await this.gatewayService.sendRequest(
      machineId,
      'fs:read',
      { path: filePath },
    )) as {
      request_id: string;
      path: string;
      content: string | null;
      size?: number;
      error?: string;
    };
    return {
      path: result.path,
      content: result.content,
      size: result.size,
      error: result.error,
    };
  }
}
