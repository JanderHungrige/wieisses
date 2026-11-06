// Which uploads are accepted: the declared type must be on the list AND the file must start with
// that type's magic bytes. No SVG — it can carry script (doc 01, "Security").

export type MediaKind = 'image' | 'audio';
type Rule = { ext: string; kind: MediaKind; matches: (b: Buffer) => boolean };

const ascii = (b: Buffer, at: number, text: string) => b.subarray(at, at + text.length).toString('latin1') === text;

const PNG: Rule = { ext: 'png', kind: 'image', matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) };
const JPEG: Rule = { ext: 'jpg', kind: 'image', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff };
const WEBP: Rule = { ext: 'webp', kind: 'image', matches: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP') };
const MP3: Rule = {
  ext: 'mp3',
  kind: 'audio',
  matches: (b) => ascii(b, 0, 'ID3') || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0),
};
const M4A: Rule = { ext: 'm4a', kind: 'audio', matches: (b) => ascii(b, 4, 'ftyp') };
const OGG: Rule = { ext: 'ogg', kind: 'audio', matches: (b) => ascii(b, 0, 'OggS') };
const WAV: Rule = { ext: 'wav', kind: 'audio', matches: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE') };

const RULES: Readonly<Record<string, Rule>> = Object.freeze({
  'image/png': PNG,
  'image/jpeg': JPEG,
  'image/webp': WEBP,
  'audio/mpeg': MP3,
  'audio/mp4': M4A,
  'audio/x-m4a': M4A,
  'audio/m4a': M4A,
  'audio/ogg': OGG,
  'audio/wav': WAV,
  'audio/x-wav': WAV,
  'audio/wave': WAV,
});

export const LIMITS: Readonly<Record<MediaKind, number>> = Object.freeze({ image: 2 * 1024 * 1024, audio: 5 * 1024 * 1024 });
export const MAX_UPLOAD = Math.max(LIMITS.image, LIMITS.audio);

export type Detected = { ok: true; ext: string; kind: MediaKind } | { ok: false; reason: 'unsupported_type' | 'too_large' };

export function detectMedia(contentType: string | undefined, bytes: Buffer): Detected {
  const rule = RULES[(contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''];
  if (!rule || bytes.length < 12 || !rule.matches(bytes)) return { ok: false, reason: 'unsupported_type' };
  if (bytes.length > LIMITS[rule.kind]) return { ok: false, reason: 'too_large' };
  return { ok: true, ext: rule.ext, kind: rule.kind };
}
