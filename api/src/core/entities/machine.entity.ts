import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

import { Thread } from './thread.entity.js';
import { User } from './user.entity.js';
import { Workspace } from './workspace.entity.js';

@Entity('machines')
export class Machine {
  @PrimaryColumn('varchar', { length: 36 })
  id: string = uuidv7();

  @Column('varchar', { length: 36 })
  user_id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 255 })
  token_hash: string;

  @Column('varchar', { length: 50, default: 'claude' })
  default_agent: string;

  @Column('varchar', { length: 100, nullable: true })
  default_model: string | null;

  @Column('enum', { enum: ['online', 'offline'], default: 'offline' })
  status: 'online' | 'offline';

  @Column('datetime', { nullable: true })
  last_seen_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @ManyToOne(() => User, (user) => user.machines)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Workspace, (workspace) => workspace.machine)
  workspaces: Workspace[];

  @OneToMany(() => Thread, (thread) => thread.machine)
  threads: Thread[];
}
