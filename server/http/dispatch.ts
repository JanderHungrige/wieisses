// Turns one request into one reply: CSRF header check, API routes, then media and the SPA.
// Expected failures are HttpErrors; anything else is logged and answered with a bare 500.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { App } from '../context.ts';
import { HttpError, errorReply, writeReply } from './reply.ts';
import { isHttps } from './request.ts';
import type { Router } from './router.ts';
import { serveMedia, serveStatic } from './static.ts';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function transportHeaders(req: IncomingMessage): Record<string, string> {
  return isHttps(req) ? { 'Strict-Transport-Security': 'max-age=31536000' } : {};
}

export async function dispatch(app: App, router: Router, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';
  try {
    if (url.pathname.startsWith('/api/') && MUTATING.has(method) && req.headers['x-wieisses'] !== '1') {
      throw new HttpError(403, 'csrf', 'Anfrage abgelehnt.');
    }
    const route = router.match(method, url.pathname);
    if (route) {
      writeReply(res, await route.handler({ req, res, url, params: route.params }), transportHeaders(req));
      return;
    }
    if ((method === 'GET' || method === 'HEAD') && !url.pathname.startsWith('/api/')) {
      const media = /^\/media\/([^/]+)$/.exec(url.pathname);
      const file = media ? await serveMedia(app.mediaDir, media[1] ?? '') : await serveStatic(app.staticDir, url.pathname);
      if (file) {
        writeReply(res, file, transportHeaders(req));
        return;
      }
    }
    throw new HttpError(404, 'not_found', 'Nicht gefunden.');
  } catch (err) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (err instanceof HttpError) {
      writeReply(res, errorReply(err), transportHeaders(req));
      return;
    }
    app.log.error('request failed', { err, method, path: url.pathname });
    writeReply(res, { status: 500, body: { error: 'server_error', message: 'Da ist etwas schiefgegangen.' } });
  }
}
