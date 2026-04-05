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

import { Machine } from './machine.entity.js';
import { Thread } from './thread.entity.js';

@Entity('workspaces')
export class Workspace {
  @PrimaryColumn('varchar', { length: 36 })
  id: string = uuidv7();

  @Column('varchar', { length: 36 })
  machine_id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 1024 })
  working_directory: string;

  @Column('text', { nullable: true })
  custom_instruction: string | null;

  @Column('varchar', { length: 50, nullable: true })
  agent: string | null;

  @Column('varchar', { length: 100, nullable: true })
  model: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @ManyToOne(() => Machine, (machine) => machine.workspaces)
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @OneToMany(() => Thread, (thread) => thread.workspace)
  threads: Thread[];
}
