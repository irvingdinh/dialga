import { Injectable, Logger } from '@nestjs/common';
import { type ChildProcess, spawn } from 'child_process';

import type {
  AgentAdapter,
  OutputEvent,
  TaskConfig,
} from './adapter.interface';

@Injectable()
export class ClaudeAdapter implements AgentAdapter {
  private readonly logger = new Logger(ClaudeAdapter.name);
  readonly name = 'claude';

  startTask(config: TaskConfig): ChildProcess {
    const prompt = this.buildPrompt(config);

    const args = [
      '--dangerously-skip-permissions',
      '--output-format',
      'stream-json',
      '--verbose',
    ];

    if (config.model) {
      args.push('--model', config.model);
    }

    args.push('--print', prompt);

    this.logger.debug(`Spawning: claude ${args.join(' ').slice(0, 200)}...`);

    return spawn('claude', args, {
      cwd: config.workingDirectory,
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

    // System init — skip
    if (type === 'system') return null;

    // Rate limit event — skip
    if (type === 'rate_limit_event') return null;

    // Result event
    if (type === 'result') {
      return {
        type: 'result',
        content: 'Task completed',
        metadata: {
          total_cost_usd: parsed.total_cost_usd,
          usage: parsed.usage,
          duration_ms: parsed.duration_ms,
        },
      };
    }

    // Assistant or user messages with content array
    if ((type === 'assistant' || type === 'user') && parsed.message) {
      const message = parsed.message as {
        content?: Array<Record<string, unknown>>;
      };
      const contentBlocks = message.content || [];

      for (const block of contentBlocks) {
        const blockType = block.type as string;

        if (blockType === 'thinking') {
          return {
            type: 'thinking',
            content: (block.thinking as string) || '',
          };
        }

        if (blockType === 'text') {
          return {
            type: type === 'user' ? 'tool_result' : 'text',
            content: (block.text as string) || '',
          };
        }

        if (blockType === 'tool_use') {
          return {
            type: 'tool_call',
            content: JSON.stringify({
              name: block.name,
              input: block.input,
            }),
            metadata: { tool_use_id: block.id as string },
          };
        }

        if (blockType === 'tool_result') {
          const resultContent = block.content as string | undefined;
          return {
            type: 'tool_result',
            content: resultContent || '',
          };
        }
      }
    }

    return null;
  }

  cancel(process: ChildProcess): void {
    if (!process.killed) {
      process.kill('SIGTERM');
    }
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
