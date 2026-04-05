import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

import { AppConfig } from '../config/config';
import { entities } from '../entities';

export const typeormForRoot = TypeOrmModule.forRootAsync({
  extraProviders: [],
  useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
    const config = configService.get<AppConfig>('root')!;

    return {
      type: 'better-sqlite3',
      database: join(config.data.dir, 'database.sqlite'),
      entities: [...entities],
      synchronize: true,
    };
  },
  inject: [ConfigService],
});
