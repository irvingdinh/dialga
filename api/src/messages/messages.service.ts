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

  async verifyThreadOwnership(
    threadId: string,
    userId: string,
  ): Promise<Thread> {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
      relations: ['machine', 'workspace'],
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.machine.user_id !== userId) throw new ForbiddenException();
    return thread;
  }

  async list(
    threadId: string,
    userId: string,
    options?: { limit?: number; before?: string; q?: string },
  ): Promise<{ messages: Message[]; has_more: boolean }> {
    await this.verifyThreadOwnership(threadId, userId);

    const limit = options?.limit ?? 50;

    const qb = this.messageRepository
      .createQueryBuilder('msg')
      .where('msg.thread_id = :threadId', { threadId });

    // Full-text search mode: skip cursor pagination, search content
    if (options?.q) {
      qb.andWhere('msg.content LIKE :q', { q: `%${options.q}%` });
      const messages = await qb
        .orderBy('msg.created_at', 'ASC')
        .addOrderBy('msg.id', 'ASC')
        .take(limit)
        .getMany();
      return { messages, has_more: false };
    }

    if (options?.before) {
      const cursor = await this.messageRepository.findOne({
        where: { id: options.before },
        select: ['created_at'],
      });
      if (cursor) {
        qb.andWhere(
          '(msg.created_at < :cursorDate OR (msg.created_at = :cursorDate AND msg.id < :cursorId))',
          { cursorDate: cursor.created_at, cursorId: options.before },
        );
      }
    }

    // Fetch limit+1 in DESC order to check has_more
    const messages = await qb
      .orderBy('msg.created_at', 'DESC')
      .addOrderBy('msg.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const has_more = messages.length > limit;
    if (has_more) messages.pop();

    // Reverse to ASC order for the client
    messages.reverse();

    return { messages, has_more };
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

    // Send cancel to agent for both queued and running messages
    // Agent handles: running → SIGTERM, queued → remove from queue
    this.gatewayService.sendToMachine(
      message.thread.machine_id,
      'task:cancel',
      { message_id: message.id },
    );

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

  async retry(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['thread', 'thread.machine', 'thread.workspace'],
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.thread.machine.user_id !== userId)
      throw new ForbiddenException();

    if (message.role !== 'assistant') {
      throw new BadRequestException('Can only retry assistant messages');
    }

    if (message.status !== 'error' && message.status !== 'timed_out') {
      throw new BadRequestException(
        `Cannot retry message with status "${message.status}"`,
      );
    }

    // Find the user message that preceded this assistant message
    const userMessage = await this.messageRepository
      .createQueryBuilder('message')
      .where('message.thread_id = :threadId', {
        threadId: message.thread_id,
      })
      .andWhere('message.role = :role', { role: 'user' })
      .andWhere('message.created_at <= :createdAt', {
        createdAt: message.created_at,
      })
      .orderBy('message.created_at', 'DESC')
      .getOne();

    if (!userMessage) {
      throw new BadRequestException('No user message found to retry');
    }

    // Create new assistant message (queued)
    const assistantMessage = this.messageRepository.create({
      thread_id: message.thread_id,
      role: 'assistant',
      content: '',
      model: message.model,
      status: 'queued',
    });
    await this.messageRepository.save(assistantMessage);

    // Touch thread updated_at
    const thread = message.thread;
    thread.updated_at = new Date();
    await this.threadRepository.save(thread);

    // Dispatch task to agent
    const dispatched = await this.gatewayService.dispatchTaskWithPrompt(
      thread.machine_id,
      assistantMessage,
      thread,
      userMessage.content,
    );

    if (!dispatched) {
      this.logger.log(
        `Machine ${thread.machine_id} offline — retry message ${assistantMessage.id} stays queued`,
      );
    }

    // Notify thread list about new activity
    await this.streamingService.publishThreadUpdate(
      thread.machine_id,
      thread.id,
      userMessage.content.slice(0, 100),
      'active',
      thread.updated_at,
    );

    return assistantMessage;
  }

  async listActive(userId: string): Promise<
    Array<{
      message_id: string;
      thread_id: string;
      thread_title: string | null;
      machine_id: string;
      machine_name: string;
      workspace_name: string | null;
      status: string;
      model: string | null;
      created_at: Date;
      started_at: Date | null;
    }>
  > {
    const rows = await this.messageRepository
      .createQueryBuilder('msg')
      .innerJoin('msg.thread', 'thread')
      .innerJoin('thread.machine', 'machine')
      .leftJoin('thread.workspace', 'workspace')
      .select([
        'msg.id AS message_id',
        'thread.id AS thread_id',
        'thread.title AS thread_title',
        'machine.id AS machine_id',
        'machine.name AS machine_name',
        'workspace.name AS workspace_name',
        'msg.status AS status',
        'msg.model AS model',
        'msg.created_at AS created_at',
        'msg.started_at AS started_at',
      ])
      .where('msg.role = :role', { role: 'assistant' })
      .andWhere('msg.status IN (:...statuses)', {
        statuses: ['queued', 'running'],
      })
      .andWhere('machine.user_id = :userId', { userId })
      .andWhere('machine.deleted_at IS NULL')
      .orderBy('msg.created_at', 'DESC')
      .getRawMany<{
        message_id: string;
        thread_id: string;
        thread_title: string | null;
        machine_id: string;
        machine_name: string;
        workspace_name: string | null;
        status: string;
        model: string | null;
        created_at: Date;
        started_at: Date | null;
      }>();

    return rows;
  }

  async listRecent(
    userId: string,
    limit = 20,
  ): Promise<
    Array<{
      message_id: string;
      thread_id: string;
      thread_title: string | null;
      machine_id: string;
      machine_name: string;
      workspace_name: string | null;
      status: string;
      model: string | null;
      content: string | null;
      created_at: Date;
      started_at: Date | null;
      completed_at: Date | null;
    }>
  > {
    const rows = await this.messageRepository
      .createQueryBuilder('msg')
      .innerJoin('msg.thread', 'thread')
      .innerJoin('thread.machine', 'machine')
      .leftJoin('thread.workspace', 'workspace')
      .select([
        'msg.id AS message_id',
        'thread.id AS thread_id',
        'thread.title AS thread_title',
        'machine.id AS machine_id',
        'machine.name AS machine_name',
        'workspace.name AS workspace_name',
        'msg.status AS status',
        'msg.model AS model',
        'SUBSTRING(msg.content, 1, 200) AS content',
        'msg.created_at AS created_at',
        'msg.started_at AS started_at',
        'msg.completed_at AS completed_at',
      ])
      .where('msg.role = :role', { role: 'assistant' })
      .andWhere('msg.status IN (:...statuses)', {
        statuses: ['completed', 'error', 'cancelled', 'timed_out'],
      })
      .andWhere('machine.user_id = :userId', { userId })
      .andWhere('machine.deleted_at IS NULL')
      .orderBy('msg.completed_at', 'DESC')
      .limit(limit)
      .getRawMany<{
        message_id: string;
        thread_id: string;
        thread_title: string | null;
        machine_id: string;
        machine_name: string;
        workspace_name: string | null;
        status: string;
        model: string | null;
        content: string | null;
        created_at: Date;
        started_at: Date | null;
        completed_at: Date | null;
      }>();

    return rows;
  }

  async getThreadUsage(
    threadId: string,
    userId: string,
  ): Promise<{
    total_cost_usd: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_duration_ms: number;
    message_count: number;
    models: Record<string, number>;
  }> {
    await this.verifyThreadOwnership(threadId, userId);

    const messages = await this.messageRepository.find({
      where: {
        thread_id: threadId,
        role: 'assistant',
        status: 'completed',
      },
      select: ['metadata', 'model'],
    });

    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalDuration = 0;
    let messageCount = 0;
    const models: Record<string, number> = {};

    for (const msg of messages) {
      if (!msg.metadata) continue;

      let parsed: {
        events?: Array<{ type: string; metadata?: Record<string, unknown> }>;
      };
      try {
        parsed =
          typeof msg.metadata === 'string'
            ? JSON.parse(msg.metadata)
            : msg.metadata;
      } catch {
        continue;
      }

      if (!parsed.events || !Array.isArray(parsed.events)) continue;

      for (const event of parsed.events) {
        if (event.type === 'result' && event.metadata) {
          const cost = event.metadata.total_cost_usd as number | undefined;
          const duration = event.metadata.duration_ms as number | undefined;
          const usage = event.metadata.usage as
            | { input_tokens?: number; output_tokens?: number }
            | undefined;

          if (cost) totalCost += cost;
          if (duration) totalDuration += duration;
          if (usage?.input_tokens) totalInputTokens += usage.input_tokens;
          if (usage?.output_tokens) totalOutputTokens += usage.output_tokens;
          messageCount++;
        }
      }

      if (msg.model) {
        models[msg.model] = (models[msg.model] || 0) + 1;
      }
    }

    return {
      total_cost_usd: totalCost,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_duration_ms: totalDuration,
      message_count: messageCount,
      models,
    };
  }

  async getGlobalUsage(userId: string): Promise<{
    total_cost_usd: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_duration_ms: number;
    message_count: number;
    models: Record<string, number>;
    by_machine: Array<{
      machine_id: string;
      machine_name: string;
      total_cost_usd: number;
      total_input_tokens: number;
      total_output_tokens: number;
      message_count: number;
    }>;
  }> {
    // Fetch all completed assistant messages across user's machines with metadata
    const rows = await this.messageRepository
      .createQueryBuilder('msg')
      .innerJoin('msg.thread', 'thread')
      .innerJoin('thread.machine', 'machine')
      .select([
        'msg.metadata AS metadata',
        'msg.model AS model',
        'machine.id AS machine_id',
        'machine.name AS machine_name',
      ])
      .where('msg.role = :role', { role: 'assistant' })
      .andWhere('msg.status = :status', { status: 'completed' })
      .andWhere('machine.user_id = :userId', { userId })
      .andWhere('machine.deleted_at IS NULL')
      .getRawMany<{
        metadata: string | null;
        model: string | null;
        machine_id: string;
        machine_name: string;
      }>();

    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalDuration = 0;
    let messageCount = 0;
    const models: Record<string, number> = {};
    const machineMap = new Map<
      string,
      {
        machine_id: string;
        machine_name: string;
        total_cost_usd: number;
        total_input_tokens: number;
        total_output_tokens: number;
        message_count: number;
      }
    >();

    for (const row of rows) {
      if (!row.metadata) continue;

      let parsed: {
        events?: Array<{ type: string; metadata?: Record<string, unknown> }>;
      };
      try {
        parsed =
          typeof row.metadata === 'string'
            ? JSON.parse(row.metadata)
            : row.metadata;
      } catch {
        continue;
      }

      if (!parsed.events || !Array.isArray(parsed.events)) continue;

      for (const event of parsed.events) {
        if (event.type === 'result' && event.metadata) {
          const cost = event.metadata.total_cost_usd as number | undefined;
          const duration = event.metadata.duration_ms as number | undefined;
          const usage = event.metadata.usage as
            | { input_tokens?: number; output_tokens?: number }
            | undefined;

          if (cost) totalCost += cost;
          if (duration) totalDuration += duration;
          if (usage?.input_tokens) totalInputTokens += usage.input_tokens;
          if (usage?.output_tokens) totalOutputTokens += usage.output_tokens;
          messageCount++;

          // Per-machine aggregation
          if (!machineMap.has(row.machine_id)) {
            machineMap.set(row.machine_id, {
              machine_id: row.machine_id,
              machine_name: row.machine_name,
              total_cost_usd: 0,
              total_input_tokens: 0,
              total_output_tokens: 0,
              message_count: 0,
            });
          }
          const m = machineMap.get(row.machine_id)!;
          if (cost) m.total_cost_usd += cost;
          if (usage?.input_tokens) m.total_input_tokens += usage.input_tokens;
          if (usage?.output_tokens)
            m.total_output_tokens += usage.output_tokens;
          m.message_count++;
        }
      }

      if (row.model) {
        models[row.model] = (models[row.model] || 0) + 1;
      }
    }

    return {
      total_cost_usd: totalCost,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_duration_ms: totalDuration,
      message_count: messageCount,
      models,
      by_machine: Array.from(machineMap.values()).sort(
        (a, b) => b.total_cost_usd - a.total_cost_usd,
      ),
    };
  }

  async edit(
    messageId: string,
    userId: string,
    content: string,
  ): Promise<{ userMessage: Message; assistantMessage: Message }> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['thread', 'thread.machine', 'thread.workspace'],
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.thread.machine.user_id !== userId)
      throw new ForbiddenException();

    if (message.role !== 'user') {
      throw new BadRequestException('Can only edit user messages');
    }

    // Update the user message content via QueryBuilder (avoids entity tracking side effects)
    await this.messageRepository
      .createQueryBuilder()
      .update()
      .set({ content })
      .where('id = :id', { id: message.id })
      .execute();
    message.content = content;

    // Find all messages after this one in the thread (using UUIDv7 ID ordering — avoids
    // datetime precision loss between MySQL microseconds and JavaScript milliseconds)
    const subsequentMessages = await this.messageRepository
      .createQueryBuilder('msg')
      .where('msg.thread_id = :threadId', { threadId: message.thread_id })
      .andWhere('msg.id > :msgId', { msgId: message.id })
      .getMany();

    // Cancel any running/queued tasks before deleting
    for (const msg of subsequentMessages) {
      if (
        msg.role === 'assistant' &&
        (msg.status === 'queued' || msg.status === 'running')
      ) {
        this.gatewayService.sendToMachine(
          message.thread.machine_id,
          'task:cancel',
          { message_id: msg.id },
        );
      }
    }

    // Delete subsequent messages using QueryBuilder (avoids TypeORM entity tracking issues)
    if (subsequentMessages.length > 0) {
      const ids = subsequentMessages.map((m) => m.id);
      await this.messageRepository
        .createQueryBuilder()
        .delete()
        .where('id IN (:...ids)', { ids })
        .execute();
    }

    // Create new assistant message (queued)
    const assistantMessage = this.messageRepository.create({
      thread_id: message.thread_id,
      role: 'assistant',
      content: '',
      model: null,
      status: 'queued',
    });
    await this.messageRepository.save(assistantMessage);

    // Touch thread updated_at
    const thread = message.thread;
    thread.updated_at = new Date();
    await this.threadRepository.save(thread);

    // Dispatch task to agent
    await this.gatewayService.dispatchTaskWithPrompt(
      thread.machine_id,
      assistantMessage,
      thread,
      content,
    );

    // Notify thread list about activity
    await this.streamingService.publishThreadUpdate(
      thread.machine_id,
      thread.id,
      content.slice(0, 100),
      'active',
      thread.updated_at,
    );

    return { userMessage: message, assistantMessage };
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
