import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Machine, Message, Thread } from '../core/entities/index.js';
import { GatewayService } from '../gateway/gateway.service.js';
import { StreamingService } from '../streaming/streaming.service.js';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
    private readonly gatewayService: GatewayService,
    private readonly streamingService: StreamingService,
  ) {}

  async verifyThreadBelongsToMachine(
    threadId: string,
    machineId: string,
  ): Promise<Thread> {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.machine_id !== machineId) throw new ForbiddenException();
    return thread;
  }

  private async verifyThreadOwnership(
    threadId: string,
    userId: string,
  ): Promise<Thread> {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
      relations: ['machine'],
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.machine.user_id !== userId) throw new ForbiddenException();
    return thread;
  }

  async list(threadId: string, userId: string): Promise<Message[]> {
    await this.verifyThreadOwnership(threadId, userId);
    return this.messageRepository.find({
      where: { thread_id: threadId },
      order: { created_at: 'ASC' },
    });
  }

  async send(
    threadId: string,
    userId: string,
    data: { content: string; model?: string },
  ): Promise<{ userMessage: Message; assistantMessage: Message }> {
    const thread = await this.verifyThreadOwnership(threadId, userId);

    // Set thread title from first user message
    if (!thread.title) {
      thread.title = data.content;
      await this.threadRepository.save(thread);
    }

    // Create user message (immediately completed)
    const userMessage = this.messageRepository.create({
      thread_id: threadId,
      role: 'user',
      content: data.content,
      status: 'completed',
    });
    await this.messageRepository.save(userMessage);

    // Create assistant message (queued, waiting for agent)
    const assistantMessage = this.messageRepository.create({
      thread_id: threadId,
      role: 'assistant',
      content: '',
      model: data.model || null,
      status: 'queued',
    });
    await this.messageRepository.save(assistantMessage);

    // Touch thread updated_at
    thread.updated_at = new Date();
    await this.threadRepository.save(thread);

    // Dispatch task to agent if machine is online
    const dispatched = await this.gatewayService.dispatchTaskWithPrompt(
      thread.machine_id,
      assistantMessage,
      thread,
      data.content,
    );

    if (!dispatched) {
      this.logger.log(
        `Machine ${thread.machine_id} offline — message ${assistantMessage.id} stays queued`,
      );
    }

    // Notify thread list about new activity
    await this.streamingService.publishThreadUpdate(
      thread.machine_id,
      threadId,
      data.content.slice(0, 100),
      'active',
      thread.updated_at,
    );

    return { userMessage, assistantMessage };
  }

  async cancel(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['thread', 'thread.machine'],
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.thread.machine.user_id !== userId)
      throw new ForbiddenException();

    if (message.status !== 'queued' && message.status !== 'running') {
      throw new BadRequestException(
        `Cannot cancel message with status "${message.status}"`,
      );
    }

    // Send cancel event to agent if task is running
    if (message.status === 'running') {
      this.gatewayService.sendToMachine(
        message.thread.machine_id,
        'task:cancel',
        { message_id: message.id },
      );
    }

    message.status = 'cancelled';
    message.completed_at = new Date();
    const saved = await this.messageRepository.save(message);

    // Notify SSE subscribers about cancellation
    await this.streamingService.publishMessageStatus(
      message.thread_id,
      message.id,
      'cancelled',
    );

    return saved;
  }

  async getAsJsonl(threadId: string): Promise<string> {
    const messages = await this.messageRepository.find({
      where: { thread_id: threadId },
      order: { created_at: 'ASC' },
    });

    return messages
      .filter((m) => m.role !== 'system' && m.content)
      .map((m) =>
        JSON.stringify({
          role: m.role,
          content: m.content,
          timestamp: m.created_at.toISOString(),
        }),
      )
      .join('\n');
  }
}
