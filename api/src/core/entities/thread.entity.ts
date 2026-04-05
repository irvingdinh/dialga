import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

import { Machine } from './machine.entity.js';
import { Message } from './message.entity.js';
import { Workspace } from './workspace.entity.js';

@Entity('threads')
export class Thread {
  @PrimaryColumn('varchar', { length: 36 })
  id: string = uuidv7();

  @Column('varchar', { length: 36 })
  machine_id: string;

  @Column('varchar', { length: 36, nullable: true })
  workspace_id: string | null;

  @Column('text', { nullable: true })
  title: string | null;

  @Column('enum', { enum: ['active', 'archived'], default: 'active' })
  status: 'active' | 'archived';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Machine, (machine) => machine.threads)
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @ManyToOne(() => Workspace, (workspace) => workspace.threads, {
    nullable: true,
  })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace | null;

  @OneToMany(() => Message, (message) => message.thread)
  messages: Message[];
}
