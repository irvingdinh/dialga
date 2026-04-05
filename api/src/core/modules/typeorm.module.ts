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
      url: config.database.url,
      entities: [...entities],
      synchronize: true,
    };
  },
  inject: [ConfigService],
});
