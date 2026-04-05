import type { ChildProcess } from 'child_process';

export interface OutputEvent {
  type:
    | 'thinking'
    | 'text'
    | 'tool_call'
    | 'tool_result'
    | 'system'
    | 'error'
    | 'result';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface TaskConfig {
  prompt: string;
  model: string | null;
  workingDirectory: string;
  contextFilePath: string;
  customInstruction: string | null;
}

export interface AgentAdapter {
  readonly name: string;
  startTask(config: TaskConfig): ChildProcess;
  parseOutput(line: string): OutputEvent | null;
  cancel(process: ChildProcess): void;
}
