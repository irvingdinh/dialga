import { Injectable, Logger } from '@nestjs/common';
import { type ChildProcess, spawn } from 'child_process';

import type {
  AgentAdapter,
  OutputEvent,
  TaskConfig,
} from './adapter.interface';

@Injectable()
export class CodexAdapter implements AgentAdapter {
  private readonly logger = new Logger(CodexAdapter.name);
  readonly name = 'codex';

  // One-behind buffer for thinking detection
  private buffer: { content: string } | null = null;
  private pendingEvents: OutputEvent[] = [];

  startTask(config: TaskConfig): ChildProcess {
    const prompt = this.buildPrompt(config);

    const args = [
      'exec',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check',
      '--config',
      'model_verbosity=high',
      '-C',
      config.workingDirectory,
      '--json',
    ];

    if (config.model) {
      args.push('--model', config.model);
    }

    args.push(prompt);

    this.logger.debug(`Spawning: codex ${args.join(' ').slice(0, 200)}...`);

    // Reset buffer for each task
    this.buffer = null;
    this.pendingEvents = [];

    return spawn('codex', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  }

  parseOutput(line: string): OutputEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }

    const type = parsed.type as string;

    // Skip thread/turn start
    if (type === 'thread.started' || type === 'turn.started') return null;

    // Agent message — one-behind buffer logic
    if (type === 'item.completed') {
      const item = parsed.item as Record<string, unknown> | undefined;
      if (!item) return null;

      const itemType = item.type as string;

      if (itemType === 'agent_message') {
        const text =
          ((item.content as Array<{ text?: string }>) || [])
            .map((c) => c.text || '')
            .join('') || '';

        // Flush previous buffer as text (it was followed by another message, not a tool)
        const flushed = this.flushBuffer('text');
        this.buffer = { content: text };
        return flushed;
      }

      if (itemType === 'file_change') {
        // Buffer was thinking (followed by tool action)
        const flushed = this.flushBuffer('thinking');
        const changes = item.changes as
          | Array<Record<string, unknown>>
          | undefined;
        this.pendingEvents.push({
          type: 'tool_call',
          content: JSON.stringify({ name: 'file_change', changes }),
        });
        return flushed || this.pendingEvents.shift() || null;
      }

      if (itemType === 'command_execution') {
        // Buffer was thinking
        const flushed = this.flushBuffer('thinking');
        const result: OutputEvent = {
          type: 'tool_result',
          content: JSON.stringify({
            command: item.command,
            output: item.aggregated_output,
            exit_code: item.exit_code,
          }),
        };
        this.pendingEvents.push(result);
        return flushed || this.pendingEvents.shift() || null;
      }
    }

    if (type === 'item.started') {
      const item = parsed.item as Record<string, unknown> | undefined;
      if (item?.type === 'command_execution') {
        const flushed = this.flushBuffer('thinking');
        const toolCall: OutputEvent = {
          type: 'tool_call',
          content: JSON.stringify({
            name: 'command_execution',
            command: item.command,
          }),
        };
        this.pendingEvents.push(toolCall);
        return flushed || this.pendingEvents.shift() || null;
      }
    }

    // Turn completed — flush buffer as text (final response)
    if (type === 'turn.completed') {
      const flushed = this.flushBuffer('text');
      const result: OutputEvent = {
        type: 'result',
        content: 'Task completed',
        metadata: { usage: parsed.usage },
      };
      this.pendingEvents.push(result);
      return flushed || this.pendingEvents.shift() || null;
    }

    return null;
  }

  cancel(process: ChildProcess): void {
    if (!process.killed) {
      process.kill('SIGTERM');
    }
  }

  private flushBuffer(asType: 'thinking' | 'text'): OutputEvent | null {
    if (!this.buffer) return null;
    const event: OutputEvent = { type: asType, content: this.buffer.content };
    this.buffer = null;
    return event;
  }

  private buildPrompt(config: TaskConfig): string {
    let prompt = `You got a new message, read the message history then answer.\n\n`;
    prompt += '```plaintext\n';
    prompt += config.prompt;
    prompt += '\n```\n\n';
    prompt += 'The context is:\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(
      {
        custom_instruction: config.customInstruction || undefined,
        message_history: config.contextFilePath,
        working_directory: config.workingDirectory,
      },
      null,
      2,
    );
    prompt += '\n```\n\n';
    prompt += 'Your response construction is:\n\n';
    prompt += '```plaintext\n';
    prompt +=
      "Respond directly to the user's message. Use the message history for context of the ongoing conversation.\n";
    prompt += '```';

    return prompt;
  }
}
