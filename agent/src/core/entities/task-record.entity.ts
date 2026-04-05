import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('task_records')
export class TaskRecord {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  message_id!: string;

  @Column({ type: 'varchar', length: 36 })
  thread_id!: string;

  @Column({ type: 'varchar', length: 1024 })
  working_directory!: string;

  @Column({ type: 'varchar', length: 20 })
  status!:
    | 'running'
    | 'completed'
    | 'error'
    | 'cancelled'
    | 'timed_out'
    | 'interrupted';

  @Column({ type: 'datetime' })
  started_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  completed_at!: Date | null;
}
