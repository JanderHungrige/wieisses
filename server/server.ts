// Routes only: request in → handler → reply out (doc 01, "API Endpoints").
import { createServer as createHttpServer, type Server } from 'node:http';
import { CodePicksSchema, NewCodeSchema, SubmissionInputSchema } from '../shared/schema.ts';
import type { App } from './context.ts';
import { health } from './handlers/health.ts';
import { kioskConfig, login, newCode, requireDevice, requireKioskSession, submit } from './handlers/kiosk.ts';
import { dispatch } from './http/dispatch.ts';
import { DEVICE_COOKIE, bearer, cookies, readJson } from './http/request.ts';
import { createRouter, type Ctx, type Router } from './http/router.ts';
import { adminRoutes } from './admin-routes.ts';

function kioskRoutes(router: Router, app: App): void {
  const device = (c: Ctx) => requireDevice(app, cookies(c.req).get(DEVICE_COOKIE));
  router
    .on('GET', '/api/v1/kiosk/config', (c) => {
      device(c);
      return kioskConfig(app);
    })
    .on('POST', '/api/v1/kiosk/codes', async (c) => newCode(app, device(c), await readJson(c.req, NewCodeSchema)))
    .on('POST', '/api/v1/kiosk/session', async (c) => login(app, device(c), await readJson(c.req, CodePicksSchema)))
    .on('POST', '/api/v1/kiosk/submissions', async (c) => {
      device(c);
      const session = requireKioskSession(app, bearer(c.req));
      return submit(app, session, await readJson(c.req, SubmissionInputSchema));
    });
}

export function createServer(app: App): Server {
  const router = createRouter();
  router.on('GET', '/healthz', () => health(app));
  kioskRoutes(router, app);
  adminRoutes(router, app);
  const server = createHttpServer((req, res) => {
    void dispatch(app, router, req, res);
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}
