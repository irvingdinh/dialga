import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';

import { GatewayService } from './gateway.service.js';

@WebSocketGateway({ path: '/ws' })
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AgentGateway.name);

  constructor(private readonly gatewayService: GatewayService) {}

  async handleConnection(socket: WebSocket, request: IncomingMessage) {
    const url = new URL(request.url || '', 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      this.logger.warn('WebSocket connection rejected: no token');
      socket.close(4001, 'Missing token');
      return;
    }

    const machine = await this.gatewayService.authenticateToken(token);
    if (!machine) {
      this.logger.warn('WebSocket connection rejected: invalid token');
      socket.close(4003, 'Invalid token');
      return;
    }

    // Register message handler BEFORE async registration to avoid dropping
    // messages the agent sends immediately on connect (e.g. crash recovery reports)
    const machineId = machine.id;
    socket.on('message', (raw: Buffer | string) => {
      void this.handleMessage(socket, machineId, raw);
    });

    await this.gatewayService.registerConnection(machineId, socket);

    // Dispatch any queued messages that were waiting while machine was offline
    await this.gatewayService.dispatchQueuedMessages(machineId);
  }

  async handleDisconnect(socket: WebSocket) {
    await this.gatewayService.handleDisconnect(socket);
  }

  private async handleMessage(
    socket: WebSocket,
    machineId: string,
    raw: Buffer | string,
  ): Promise<void> {
    let parsed: { event: string; data?: unknown };
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      this.logger.warn(`Invalid JSON from machine ${machineId}`);
      return;
    }

    switch (parsed.event) {
      case 'heartbeat':
        this.gatewayService.handleHeartbeat(socket);
        break;

      case 'health:report':
        this.gatewayService.handleHealthReport(
          machineId,
          (parsed.data as Record<string, unknown>) || {},
        );
        break;

      case 'task:started':
        await this.gatewayService.handleTaskStarted(
          machineId,
          parsed.data as { message_id: string },
        );
        break;

      case 'task:output':
        await this.gatewayService.handleTaskOutput(
          machineId,
          parsed.data as {
            message_id: string;
            type: string;
            content: string;
          },
        );
        break;

      case 'task:complete':
        await this.gatewayService.handleTaskComplete(
          machineId,
          parsed.data as {
            message_id: string;
            status: 'completed' | 'error' | 'cancelled' | 'timed_out';
            summary?: string;
            metadata?: Record<string, unknown>;
          },
        );
        break;

      case 'fs:list:result':
      case 'fs:mkdir:result':
        this.gatewayService.handleRequestResult(
          parsed.data as { request_id: string } & Record<string, unknown>,
        );
        break;

      default:
        this.logger.warn(
          `Unknown event "${parsed.event}" from machine ${machineId}`,
        );
    }
  }
}
