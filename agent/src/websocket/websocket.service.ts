import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';

import { AppConfig } from '../core/config/config';

@Injectable()
export class WebSocketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebSocketService.name);
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 60_000;
  private intentionalClose = false;
  private readonly config: AppConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.config = this.configService.get<AppConfig>('root')!;
  }

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.intentionalClose = true;
    this.cleanup();
  }

  private connect(): void {
    const { server, token } = this.config.agent;

    const wsUrl =
      server.replace(/^http/, 'ws') + `/ws?token=${encodeURIComponent(token)}`;
    this.logger.log(`Connecting to ${server}/ws ...`);

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.logger.log('Connected to API server');
      this.reconnectDelay = 1000; // Reset backoff
      this.startHeartbeat();
      this.eventEmitter.emit('ws.connected');
    });

    this.ws.on('message', (raw: Buffer | string) => {
      this.handleMessage(raw);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.warn(
        `WebSocket closed: code=${code} reason=${reason.toString()}`,
      );
      this.stopHeartbeat();

      if (code === 4001 || code === 4003) {
        this.logger.error('Authentication failed. Check your --token.');
        process.exit(1);
      }

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
      this.logger.error(`WebSocket error: ${err.message}`);
    });
  }

  private handleMessage(raw: Buffer | string): void {
    let parsed: { event: string; data?: unknown };
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      this.logger.warn('Received invalid JSON from server');
      return;
    }

    this.eventEmitter.emit(`ws.${parsed.event}`, parsed.data);
  }

  send(event: string, data?: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Cannot send "${event}": WebSocket not connected`);
      return;
    }
    this.ws.send(JSON.stringify({ event, data }));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send('heartbeat');
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    this.logger.log(`Reconnecting in ${this.reconnectDelay / 1000}s ...`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay,
      );
      this.connect();
    }, this.reconnectDelay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Agent shutting down');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
