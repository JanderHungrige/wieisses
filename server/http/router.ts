// A small method + path router: '/api/v1/admin/topics/:id' style patterns, numeric ids only.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, type Reply } from './reply.ts';

export type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, number>;
};
export type RouteHandler = (ctx: Ctx) => Reply | Promise<Reply>;
type Route = { method: string; parts: string[]; handler: RouteHandler };

export type Router = {
  on(method: string, pattern: string, handler: RouteHandler): Router;
  /** The matching route's handler with its params, or undefined when no path matches. */
  match(method: string, path: string): { handler: RouteHandler; params: Record<string, number> } | undefined;
};

function matchParts(parts: string[], segments: string[]): Record<string, number> | undefined {
  if (parts.length !== segments.length) return undefined;
  const params: Record<string, number> = {};
  for (const [i, part] of parts.entries()) {
    const segment = segments[i] ?? '';
    if (part.startsWith(':')) {
      if (!/^[1-9]\d{0,9}$/.test(segment)) return undefined;
      params[part.slice(1)] = Number(segment);
    } else if (part !== segment) {
      return undefined;
    }
  }
  return params;
}

export function createRouter(): Router {
  const routes: Route[] = [];
  const router: Router = {
    on(method, pattern, handler) {
      routes.push({ method, parts: pattern.split('/').filter(Boolean), handler });
      return router;
    },
    match(method, path) {
      const segments = path.split('/').filter(Boolean);
      let pathMatched = false;
      for (const route of routes) {
        const params = matchParts(route.parts, segments);
        if (!params) continue;
        pathMatched = true;
        if (route.method === method) return { handler: route.handler, params };
      }
      if (pathMatched) throw new HttpError(405, 'method_not_allowed', 'Methode nicht erlaubt.');
      return undefined;
    },
  };
  return router;
}
