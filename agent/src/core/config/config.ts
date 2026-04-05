import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface AppConfig {
  http: {
    host: string;
    port: number;
  };
  data: {
    dir: string;
  };
  agent: {
    token: string;
    server: string;
  };
}

export const config = (): { root: AppConfig } => ({
  root: {
    http: {
      host: process.env.HOST || '127.0.0.1',
      port: parseInt(process.env.PORT || '48320', 10),
    },
    data: {
      dir: ensureDataDir(),
    },
    agent: {
      token: resolveArg('token') || process.env.DIALGA_TOKEN || '',
      server:
        resolveArg('server') ||
        process.env.DIALGA_SERVER ||
        'http://localhost:48310',
    },
  },
});

const resolveArg = (name: string): string | undefined => {
  const args = process.argv.slice(2);
  const prefix = `--${name}`;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === prefix && args[i + 1]) {
      return args[i + 1];
    }
    if (args[i].startsWith(`${prefix}=`)) {
      return args[i].slice(prefix.length + 1);
    }
  }
  return undefined;
};

const ensureDataDir = (): string => {
  let dir = join(homedir(), '.dialga');
  if (process.env.DATA_DIR) {
    dir = process.env.DATA_DIR;
  }

  mkdirSync(dir, { recursive: true });

  return dir;
};
