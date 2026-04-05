export interface AppConfig {
  http: {
    host: string;
    port: number;
  };
  database: {
    url: string;
  };
  redis: {
    url?: string;
    host: string;
    port: number;
    user?: string;
    password?: string;
  };
  jwt: {
    secret: string;
    accessTokenExpirySeconds: number;
    refreshTokenDays: number;
  };
}

export const config = (): { root: AppConfig } => ({
  root: {
    http: {
      host: process.env.HOST || '127.0.0.1',
      port: parseInt(process.env.PORT || '48310', 10),
    },
    database: {
      url: process.env.MYSQL_URL || 'mysql://root@localhost:3306/dialga',
    },
    redis: {
      url: process.env.REDIS_URL || undefined,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      user: process.env.REDIS_USER || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    jwt: {
      secret:
        process.env.JWT_SECRET || 'dialga-dev-secret-change-in-production',
      accessTokenExpirySeconds: 900,
      refreshTokenDays: 365,
    },
  },
});
