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
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      name: process.env.DB_NAME || 'dialga',
    },
    jwt: {
      secret:
        process.env.JWT_SECRET || 'dialga-dev-secret-change-in-production',
      accessTokenExpirySeconds: 900,
      refreshTokenDays: 365,
    },
  },
});
