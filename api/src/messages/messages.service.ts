import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Machine, Message, Thread } from '../core/entities/index.js';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
  ) {}

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

    message.status = 'cancelled';
    message.completed_at = new Date();
    return this.messageRepository.save(message);
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
