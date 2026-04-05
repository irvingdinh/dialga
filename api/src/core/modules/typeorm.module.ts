import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { AppConfig } from '../config/config';
import { entities } from '../entities';

export const typeormForRoot = TypeOrmModule.forRootAsync({
  extraProviders: [],
  useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
    const config = configService.get<AppConfig>('root')!;

    return {
      type: 'mysql',
      host: config.database.host,
      port: config.database.port,
      username: config.database.username,
      password: config.database.password,
      database: config.database.name,
      entities: [...entities],
      synchronize: true,
    };
  },
  inject: [ConfigService],
});
