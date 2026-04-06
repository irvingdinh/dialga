import { Injectable } from '@nestjs/common';

import { GatewayService } from './gateway.service.js';

@Injectable()
export class GitProxyService {
  constructor(private readonly gatewayService: GatewayService) {}

  async status(
    machineId: string,
    dirPath: string,
  ): Promise<{
    root?: string;
    branch?: string;
    files?: Array<{ status: string; path: string; staged: boolean }>;
    error?: string;
  }> {
    const result = (await this.gatewayService.sendRequest(
      machineId,
      'git:status',
      { path: dirPath },
    )) as {
      request_id: string;
      root?: string;
      branch?: string;
      files?: Array<{ status: string; path: string; staged: boolean }>;
      error?: string;
    };
    return {
      root: result.root,
      branch: result.branch,
      files: result.files,
      error: result.error,
    };
  }

  async diff(
    machineId: string,
    dirPath: string,
    file?: string,
  ): Promise<{ diff: string; file?: string | null; error?: string }> {
    const result = (await this.gatewayService.sendRequest(
      machineId,
      'git:diff',
      { path: dirPath, file },
    )) as {
      request_id: string;
      diff: string;
      file?: string | null;
      error?: string;
    };
    return { diff: result.diff, file: result.file, error: result.error };
  }

  async log(
    machineId: string,
    dirPath: string,
    limit?: number,
  ): Promise<{
    entries: Array<{
      hash: string;
      short_hash: string;
      author: string;
      date: string;
      message: string;
    }>;
    error?: string;
  }> {
    const result = (await this.gatewayService.sendRequest(
      machineId,
      'git:log',
      { path: dirPath, limit },
    )) as {
      request_id: string;
      entries: Array<{
        hash: string;
        short_hash: string;
        author: string;
        date: string;
        message: string;
      }>;
      error?: string;
    };
    return { entries: result.entries, error: result.error };
  }

  async stage(
    machineId: string,
    dirPath: string,
    files: string[],
  ): Promise<{ success: boolean; error?: string }> {
    const result = (await this.gatewayService.sendRequest(
      machineId,
      'git:stage',
      { path: dirPath, files },
    )) as {
      request_id: string;
      success: boolean;
      error?: string;
    };
    return { success: result.success, error: result.error };
  }

  async unstage(
    machineId: string,
    dirPath: string,
    files: string[],
  ): Promise<{ success: boolean; error?: string }> {
    const result = (await this.gatewayService.sendRequest(
      machineId,
      'git:unstage',
      { path: dirPath, files },
    )) as {
      request_id: string;
      success: boolean;
      error?: string;
    };
    return { success: result.success, error: result.error };
  }

  async commit(
    machineId: string,
    dirPath: string,
    message: string,
  ): Promise<{
    success: boolean;
    commit?: {
      hash: string;
      short_hash: string;
      author: string;
      date: string;
      message: string;
    };
    error?: string;
  }> {
    const result = (await this.gatewayService.sendRequest(
      machineId,
      'git:commit',
      { path: dirPath, message },
    )) as {
      request_id: string;
      success: boolean;
      commit?: {
        hash: string;
        short_hash: string;
        author: string;
        date: string;
        message: string;
      };
      error?: string;
    };
    return {
      success: result.success,
      commit: result.commit,
      error: result.error,
    };
  }
}
