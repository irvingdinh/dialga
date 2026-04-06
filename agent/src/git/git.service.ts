import { execSync } from 'node:child_process';
import path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { WebSocketService } from '../websocket/websocket.service';

interface GitRequest {
  request_id: string;
  path: string;
}

interface GitDiffRequest extends GitRequest {
  file?: string;
}

interface GitLogRequest extends GitRequest {
  limit?: number;
}

interface GitStageRequest {
  request_id: string;
  path: string;
  files: string[];
}

interface GitCommitRequest {
  request_id: string;
  path: string;
  message: string;
}

interface GitStatusEntry {
  status: string;
  path: string;
  staged: boolean;
}

interface GitLogEntry {
  hash: string;
  short_hash: string;
  author: string;
  date: string;
  message: string;
}

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);

  constructor(private readonly ws: WebSocketService) {}

  private execGit(command: string, cwd: string): string {
    return execSync(command, {
      cwd,
      encoding: 'utf-8',
      timeout: 10_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trimEnd();
  }

  @OnEvent('ws.git:status')
  handleGitStatus(data: GitRequest): void {
    const dirPath = data.path;

    try {
      const resolved = path.resolve(dirPath);

      // Verify it's a git repo
      const root = this.execGit('git rev-parse --show-toplevel', resolved);

      // Get current branch
      let branch = '';
      try {
        branch = this.execGit('git rev-parse --abbrev-ref HEAD', resolved);
      } catch {
        branch = 'HEAD (detached)';
      }

      // Get porcelain status
      const statusOutput = this.execGit('git status --porcelain', resolved);
      const files: GitStatusEntry[] = [];

      if (statusOutput) {
        for (const line of statusOutput.split('\n')) {
          if (!line) continue;
          const index = line[0];
          const worktree = line[1];
          const filePath = line.slice(3);

          // Staged changes (index has a letter)
          if (index !== ' ' && index !== '?') {
            files.push({ status: index, path: filePath, staged: true });
          }
          // Unstaged changes (worktree has a letter, or untracked)
          if (worktree !== ' ' || index === '?') {
            files.push({
              status: index === '?' ? '?' : worktree,
              path: filePath,
              staged: false,
            });
          }
        }
      }

      this.ws.send('git:status:result', {
        request_id: data.request_id,
        root,
        branch,
        files,
      });
    } catch (err) {
      this.logger.warn(
        `git:status failed for ${dirPath}: ${(err as Error).message}`,
      );
      this.ws.send('git:status:result', {
        request_id: data.request_id,
        error: (err as Error).message,
      });
    }
  }

  @OnEvent('ws.git:diff')
  handleGitDiff(data: GitDiffRequest): void {
    const dirPath = data.path;

    try {
      const resolved = path.resolve(dirPath);

      let diff: string;
      if (data.file) {
        // Diff for a specific file (combined staged + unstaged)
        diff = this.execGit(
          `git diff HEAD -- ${JSON.stringify(data.file)}`,
          resolved,
        );
        // If HEAD diff is empty, try unstaged only (for untracked won't work, but covers most cases)
        if (!diff) {
          diff = this.execGit(
            `git diff -- ${JSON.stringify(data.file)}`,
            resolved,
          );
        }
      } else {
        // All changes: unstaged + staged combined
        diff = this.execGit('git diff HEAD', resolved);
        if (!diff) {
          diff = this.execGit('git diff', resolved);
        }
      }

      this.ws.send('git:diff:result', {
        request_id: data.request_id,
        diff,
        file: data.file || null,
      });
    } catch (err) {
      this.logger.warn(
        `git:diff failed for ${dirPath}: ${(err as Error).message}`,
      );
      this.ws.send('git:diff:result', {
        request_id: data.request_id,
        diff: '',
        error: (err as Error).message,
      });
    }
  }

  @OnEvent('ws.git:log')
  handleGitLog(data: GitLogRequest): void {
    const dirPath = data.path;
    const limit = data.limit || 20;

    try {
      const resolved = path.resolve(dirPath);

      const logOutput = this.execGit(
        `git log --format=%H%n%h%n%an%n%aI%n%s -n ${limit}`,
        resolved,
      );

      const entries: GitLogEntry[] = [];
      if (logOutput) {
        const lines = logOutput.split('\n');
        for (let i = 0; i + 4 < lines.length; i += 5) {
          entries.push({
            hash: lines[i],
            short_hash: lines[i + 1],
            author: lines[i + 2],
            date: lines[i + 3],
            message: lines[i + 4],
          });
        }
      }

      this.ws.send('git:log:result', {
        request_id: data.request_id,
        entries,
      });
    } catch (err) {
      this.logger.warn(
        `git:log failed for ${dirPath}: ${(err as Error).message}`,
      );
      this.ws.send('git:log:result', {
        request_id: data.request_id,
        entries: [],
        error: (err as Error).message,
      });
    }
  }

  @OnEvent('ws.git:stage')
  handleGitStage(data: GitStageRequest): void {
    const dirPath = data.path;

    try {
      const resolved = path.resolve(dirPath);

      for (const file of data.files) {
        this.execGit(`git add -- ${JSON.stringify(file)}`, resolved);
      }

      this.ws.send('git:stage:result', {
        request_id: data.request_id,
        success: true,
      });
    } catch (err) {
      this.logger.warn(
        `git:stage failed for ${dirPath}: ${(err as Error).message}`,
      );
      this.ws.send('git:stage:result', {
        request_id: data.request_id,
        success: false,
        error: (err as Error).message,
      });
    }
  }

  @OnEvent('ws.git:unstage')
  handleGitUnstage(data: GitStageRequest): void {
    const dirPath = data.path;

    try {
      const resolved = path.resolve(dirPath);

      for (const file of data.files) {
        this.execGit(`git reset HEAD -- ${JSON.stringify(file)}`, resolved);
      }

      this.ws.send('git:unstage:result', {
        request_id: data.request_id,
        success: true,
      });
    } catch (err) {
      this.logger.warn(
        `git:unstage failed for ${dirPath}: ${(err as Error).message}`,
      );
      this.ws.send('git:unstage:result', {
        request_id: data.request_id,
        success: false,
        error: (err as Error).message,
      });
    }
  }

  @OnEvent('ws.git:commit')
  handleGitCommit(data: GitCommitRequest): void {
    const dirPath = data.path;

    try {
      const resolved = path.resolve(dirPath);

      // Verify there are staged changes
      const staged = this.execGit('git diff --cached --name-only', resolved);
      if (!staged) {
        this.ws.send('git:commit:result', {
          request_id: data.request_id,
          success: false,
          error: 'Nothing staged to commit',
        });
        return;
      }

      // Commit with the provided message
      const escapedMessage = data.message.replace(/'/g, "'\\''");
      this.execGit(`git commit -m '${escapedMessage}'`, resolved);

      // Return the new commit info
      const logOutput = this.execGit(
        'git log --format=%H%n%h%n%an%n%aI%n%s -n 1',
        resolved,
      );
      const lines = logOutput.split('\n');

      this.ws.send('git:commit:result', {
        request_id: data.request_id,
        success: true,
        commit: {
          hash: lines[0],
          short_hash: lines[1],
          author: lines[2],
          date: lines[3],
          message: lines[4],
        },
      });
    } catch (err) {
      this.logger.warn(
        `git:commit failed for ${dirPath}: ${(err as Error).message}`,
      );
      this.ws.send('git:commit:result', {
        request_id: data.request_id,
        success: false,
        error: (err as Error).message,
      });
    }
  }
}
