import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AppConfig } from './core/config/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });
  const config = app.get(ConfigService).get<AppConfig>('root')!;

  if (!config.agent.token) {
    const logger = new Logger('Bootstrap');
    logger.error('Missing required --token argument');
    logger.error(
      'Usage: bun run start -- --token <machine-token> [--server <url>]',
    );
    process.exit(1);
  }

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(config.http.port, config.http.host);

  const logger = new Logger('Bootstrap');
  logger.log(`Agent started — server: ${config.agent.server}`);
  logger.log(`Agent HTTP listening on ${config.http.host}:${config.http.port}`);
}

void bootstrap();
