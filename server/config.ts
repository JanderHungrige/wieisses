// Environment → configuration, read once at startup. Fails loudly instead of running with a
// weak or missing admin password.
import { join, resolve } from 'node:path';

export type Config = {
  env: string;
  port: number;
  dataDir: string;
  dbFile: string;
  mediaDir: string;
  backupDir: string;
  staticDir: string;
  adminPassword: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const adminPassword = env.ADMIN_PASSWORD ?? '';
  if (adminPassword.length < 10) {
    throw new Error('ADMIN_PASSWORD must be set and at least 10 characters long');
  }
  const dataDir = resolve(env.DATA_DIR ?? '/data');
  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`invalid PORT: ${env.PORT}`);
  return {
    env: env.APP_ENV ?? 'prod',
    port,
    dataDir,
    dbFile: join(dataDir, 'wieisses.sqlite'),
    mediaDir: join(dataDir, 'media'),
    backupDir: join(dataDir, 'backups'),
    staticDir: resolve(env.STATIC_DIR ?? join(import.meta.dirname, '..', 'dist')),
    adminPassword,
  };
}
