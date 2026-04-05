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
  },
});

const ensureDataDir = (): string => {
  let dir = join(homedir(), '.dialga');
  if (process.env.DATA_DIR) {
    dir = process.env.DATA_DIR;
  }

  mkdirSync(dir, { recursive: true });

  return dir;
};
