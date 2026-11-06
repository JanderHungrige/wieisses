// Process lifecycle: open and migrate the database, seed an empty one, serve, and on SIGTERM
// stop accepting, drain, close the database and exit. A crash exits non-zero so Docker restarts.
import { mkdirSync } from 'node:fs';
import { loadConfig } from './config.ts';
import { createAppContext } from './context.ts';
import { migrate, openDatabase, SCHEMA_VERSION } from './adapters/db.ts';
import { log } from './log.ts';
import { seedIfEmpty } from './seed.ts';
import { createServer } from './server.ts';

process.on('uncaughtException', (err) => {
  log.error('uncaught exception', { err });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  log.error('unhandled rejection', { reason: reason instanceof Error ? reason : String(reason) });
  process.exit(1);
});

const config = loadConfig();
mkdirSync(config.mediaDir, { recursive: true });
const db = openDatabase(config.dbFile);
const from = await migrate(db, config.backupDir, new Date());
if (from !== SCHEMA_VERSION) log.info('database migrated', { from, to: SCHEMA_VERSION });
if (seedIfEmpty(db, new Date())) log.info('starter content seeded');

const app = createAppContext({
  db,
  env: config.env,
  mediaDir: config.mediaDir,
  staticDir: config.staticDir,
  adminPassword: config.adminPassword,
  voiceUrl: config.voiceUrl,
  log,
});
const server = createServer(app);
server.listen(config.port, () => {
  log.info('listening', { port: config.port, env: config.env, voice: app.voice.configured });
  // Fixed phrases on a fresh install, and whatever an earlier run left missing.
  if (app.voice.configured) setTimeout(() => app.voice.generate('missing'), 5_000).unref();
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('shutting down', { signal });
  const force = setTimeout(() => {
    log.error('shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
  force.unref();
  try {
    const closed = new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    server.closeIdleConnections(); // keep-alive sockets would otherwise hold close() open
    await closed;
    db.close();
    clearTimeout(force);
    process.exit(0);
  } catch (err) {
    log.error('error during shutdown', { err });
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
