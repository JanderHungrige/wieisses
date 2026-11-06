// Admin routes: request in → handler → reply out (doc 01, "Admin"). Every route but login
// requires the admin session.
import { z } from 'zod';
import {
  CodePatch,
  DeviceCreate,
  DevicePatch,
  LoginSchema,
  OptionCreate,
  OptionPatch,
  QuestionCreate,
  QuestionPatch,
  ResultsQuerySchema,
  SettingsSchema,
  TopicCreate,
  TopicPatch,
  VoiceClipSchema,
  VoiceGenerateSchema,
} from '../shared/schema.ts';
import type { App } from './context.ts';
import { changeCode, changeDevice, codesOverview, devices, registerThisDevice, replaceSettings, settings } from './handlers/access.ts';
import { loginAdmin, logoutAdmin, requireAdmin } from './handlers/admin-auth.ts';
import * as content from './handlers/content.ts';
import { uploadMedia } from './handlers/media.ts';
import { exportCsv, questionResults, summary } from './handlers/results.ts';
import { generateVoice, revoiceText, voiceStatus } from './handlers/voice.ts';
import { MAX_UPLOAD } from './domain/media-type.ts';
import { ok } from './http/reply.ts';
import { ADMIN_COOKIE, DEVICE_COOKIE, clientIp, cookieHeader, cookies, parseWith, readBody, readJson } from './http/request.ts';
import type { Ctx, Router } from './http/router.ts';

const CodeFilter = z.object({
  grade: z.coerce.number().pipe(z.int().min(1).max(6)).optional(),
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

const query = (c: Ctx) => Object.fromEntries(c.url.searchParams);
const id = (c: Ctx) => c.params.id ?? 0;

export function adminRoutes(router: Router, app: App): void {
  const token = (c: Ctx) => cookies(c.req).get(ADMIN_COOKIE);
  const adminCookie = (c: Ctx) => (value: string, maxAge: number) => cookieHeader(c.req, ADMIN_COOKIE, value, maxAge);
  const deviceCookie = (c: Ctx) => (value: string, maxAge: number) => cookieHeader(c.req, DEVICE_COOKIE, value, maxAge);
  const admin = (c: Ctx) => requireAdmin(app, token(c));

  router
    .on('POST', '/api/v1/admin/login', async (c) =>
      loginAdmin(app, clientIp(c.req), (await readJson(c.req, LoginSchema)).password, adminCookie(c)),
    )
    .on('POST', '/api/v1/admin/logout', (c) => logoutAdmin(app, token(c), adminCookie(c)))
    .on('GET', '/api/v1/admin/me', (c) => (admin(c), ok({ ok: true })));

  router
    .on('GET', '/api/v1/admin/topics', (c) => (admin(c), content.listTopics(app)))
    .on('POST', '/api/v1/admin/topics', async (c) => (admin(c), content.createTopic(app, await readJson(c.req, TopicCreate))))
    .on('PATCH', '/api/v1/admin/topics/:id', async (c) => (admin(c), content.updateTopic(app, id(c), await readJson(c.req, TopicPatch))))
    .on('DELETE', '/api/v1/admin/topics/:id', (c) => (admin(c), content.removeTopic(app, id(c))))
    .on('POST', '/api/v1/admin/topics/:id/questions', async (c) => (admin(c), content.createQuestion(app, id(c), await readJson(c.req, QuestionCreate))))
    .on('PATCH', '/api/v1/admin/questions/:id', async (c) => (admin(c), content.updateQuestion(app, id(c), await readJson(c.req, QuestionPatch))))
    .on('DELETE', '/api/v1/admin/questions/:id', (c) => (admin(c), content.removeQuestion(app, id(c))))
    .on('POST', '/api/v1/admin/questions/:id/options', async (c) => (admin(c), content.createOption(app, id(c), await readJson(c.req, OptionCreate))))
    .on('PATCH', '/api/v1/admin/options/:id', async (c) => (admin(c), content.updateOption(app, id(c), await readJson(c.req, OptionPatch))))
    .on('DELETE', '/api/v1/admin/options/:id', (c) => (admin(c), content.removeOption(app, id(c))))
    .on('POST', '/api/v1/admin/media', async (c) => (admin(c), uploadMedia(app, c.req.headers['content-type'], await readBody(c.req, MAX_UPLOAD))));

  router
    .on('GET', '/api/v1/admin/codes', (c) => (admin(c), codesOverview(app, parseWith(CodeFilter, query(c)))))
    .on('PATCH', '/api/v1/admin/codes/:id', async (c) => (admin(c), changeCode(app, id(c), await readJson(c.req, CodePatch))))
    .on('GET', '/api/v1/admin/devices', (c) => (admin(c), devices(app)))
    .on('POST', '/api/v1/admin/devices', async (c) => (admin(c), registerThisDevice(app, (await readJson(c.req, DeviceCreate)).label, deviceCookie(c))))
    .on('PATCH', '/api/v1/admin/devices/:id', async (c) => (admin(c), changeDevice(app, id(c), await readJson(c.req, DevicePatch))))
    .on('GET', '/api/v1/admin/settings', (c) => (admin(c), settings(app)))
    .on('PUT', '/api/v1/admin/settings', async (c) => (admin(c), replaceSettings(app, await readJson(c.req, SettingsSchema))));

  router
    .on('GET', '/api/v1/admin/results/summary', (c) => (admin(c), summary(app, parseWith(ResultsQuerySchema, query(c)))))
    .on('GET', '/api/v1/admin/results/questions/:id', (c) => (admin(c), questionResults(app, id(c), parseWith(ResultsQuerySchema, query(c)))))
    .on('GET', '/api/v1/admin/results/export.csv', (c) => (admin(c), exportCsv(app, parseWith(ResultsQuerySchema, query(c)))));

  router
    .on('GET', '/api/v1/admin/voice', (c) => (admin(c), voiceStatus(app)))
    .on('POST', '/api/v1/admin/voice/generate', async (c) => (admin(c), generateVoice(app, (await readJson(c.req, VoiceGenerateSchema)).mode)))
    .on('POST', '/api/v1/admin/voice/clip', async (c) => (admin(c), revoiceText(app, (await readJson(c.req, VoiceClipSchema)).text)));
}
