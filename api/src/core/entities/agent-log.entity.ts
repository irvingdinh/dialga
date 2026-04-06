import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

import { Machine } from './machine.entity.js';

@Entity('agent_logs')
export class AgentLog {
  @PrimaryColumn('varchar', { length: 36 })
  id: string = uuidv7();

  @Column('varchar', { length: 36 })
  @Index()
  machine_id: string;

  @Column('varchar', { length: 50 })
  type: string;

  @Column('text')
  message: string;

  @Column('longtext', { nullable: true })
  metadata: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Machine)
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;
}
