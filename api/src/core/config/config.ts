import { ServiceAccount } from 'firebase-admin';

export interface AppConfig {
  http: {
    host: string;
    port: number;
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
  };
  services: {
    firebase: {
      serviceAccount: ServiceAccount;
    };
  };
}

export const config = (): { root: AppConfig } => ({
  root: {
    http: {
      host: process.env.HOST || '127.0.0.1',
      port: parseInt(process.env.PORT || '48310', 10),
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      name: process.env.DB_NAME || 'dialga',
    },
    services: {
      firebase: {
        serviceAccount: ensureFirebaseServiceAccount(),
      },
    },
  },
});

const ensureFirebaseServiceAccount = (): ServiceAccount => {
  const serviceAccountAsBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountAsBase64) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT is required.`);
  }

  return JSON.parse(
    Buffer.from(serviceAccountAsBase64, 'base64').toString(),
  ) as ServiceAccount;
};
