// GET /healthz — what the container healthcheck, auto-deploy.sh and the outside probe ask.
import type { App } from '../context.ts';
import { ok, type Reply } from '../http/reply.ts';

export function health(app: App): Reply {
  try {
    app.db.prepare('SELECT 1').get();
    return ok({ status: 'ok', environment: app.env });
  } catch (err) {
    app.log.error('health check failed', { err });
    return { status: 503, body: { status: 'error', environment: app.env } };
  }
}
