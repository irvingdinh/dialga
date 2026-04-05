import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

import { Machine } from './machine.entity.js';
import { RefreshToken } from './refresh-token.entity.js';

@Entity('users')
export class User {
  @PrimaryColumn('varchar', { length: 36 })
  id: string = uuidv7();

  @Column('varchar', { length: 255, unique: true })
  email: string;

  @Column('varchar', { length: 255 })
  password_hash: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 255, nullable: true })
  external_id: string | null;

  @Column('varchar', { length: 50, nullable: true })
  external_provider: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @OneToMany(() => Machine, (machine) => machine.user)
  machines: Machine[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refresh_tokens: RefreshToken[];
}
