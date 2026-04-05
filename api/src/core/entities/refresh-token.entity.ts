import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

import { User } from './user.entity.js';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryColumn('varchar', { length: 36 })
  id: string = uuidv7();

  @Column('varchar', { length: 36 })
  user_id: string;

  @Column('varchar', { length: 255 })
  token_hash: string;

  @Column('datetime')
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (user) => user.refresh_tokens)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
