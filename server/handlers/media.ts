// Uploads of question pictures and recordings (doc 01, POST /api/v1/admin/media).
import { storeMedia } from '../adapters/media-store.ts';
import { detectMedia } from '../domain/media-type.ts';
import type { App } from '../context.ts';
import { HttpError, created, type Reply } from '../http/reply.ts';

export async function uploadMedia(app: App, contentType: string | undefined, bytes: Buffer): Promise<Reply> {
  const detected = detectMedia(contentType, bytes);
  if (!detected.ok) {
    if (detected.reason === 'too_large') {
      throw new HttpError(413, 'too_large', 'Die Datei ist zu groß (Bilder bis 2 MB, Audio bis 5 MB).');
    }
    throw new HttpError(415, 'unsupported_type', 'Erlaubt sind PNG, JPEG, WebP, MP3, M4A, OGG und WAV.');
  }
  const url = await storeMedia(app.mediaDir, detected.ext, bytes);
  app.log.info('media stored', { kind: detected.kind, bytes: bytes.length });
  return created({ url });
}
