import { Module } from '@nestjs/common';

import { ClaudeAdapter } from './claude.adapter';
import { CodexAdapter } from './codex.adapter';

@Module({
  providers: [ClaudeAdapter, CodexAdapter],
  exports: [ClaudeAdapter, CodexAdapter],
})
export class AdaptersModule {}
