import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

import { Thread } from './thread.entity.js';

@Entity('messages')
export class Message {
  @PrimaryColumn('varchar', { length: 36 })
  id: string = uuidv7();

  @Column('varchar', { length: 36 })
  thread_id: string;

  @Column('enum', { enum: ['user', 'assistant', 'system'] })
  role: 'user' | 'assistant' | 'system';

  @Column('mediumtext')
  content: string;

  @Column('varchar', { length: 100, nullable: true })
  model: string | null;

  @Column('enum', {
    enum: ['queued', 'running', 'completed', 'cancelled', 'error', 'timed_out'],
    default: 'queued',
  })
  status:
    | 'queued'
    | 'running'
    | 'completed'
    | 'cancelled'
    | 'error'
    | 'timed_out';

  @Column('longtext', { nullable: true })
  metadata: string | null;

  @Column('datetime', { nullable: true })
  started_at: Date | null;

  @Column('datetime', { nullable: true })
  completed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Thread, (thread) => thread.messages)
  @JoinColumn({ name: 'thread_id' })
  thread: Thread;
}
