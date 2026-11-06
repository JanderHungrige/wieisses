// Which texts get a Thorsten clip and how a clip is keyed (doc 01, "Voice (Thorsten)").
import { createHash } from 'node:crypto';
import { fixedPhrases, normaliseText } from '../../shared/phrases.ts';

export const VOICE_ID = 'thorsten-high';
export const VOICE_NAME = 'Thorsten (high)';

/** Piper's length scale from the kiosk's speech rate: slower speech, longer scale. */
export function lengthScaleFor(speechRate: number): number {
  return Math.round((1 / speechRate) * 100) / 100;
}

/** sha256 of voice, speed and normalised text — a changed text or speed has no clip yet. */
export function clipKey(text: string, lengthScale: number): string {
  return createHash('sha256').update(`${VOICE_ID}|${lengthScale.toFixed(2)}|${normaliseText(text)}`).digest('hex');
}

type Active = { active: boolean };
export type ContentForVoice = (Active & {
  name: string;
  questions: (Active & { text: string; options: (Active & { label: string })[] })[];
})[];

/** Fixed phrases plus everything an active topic shows, normalised and without duplicates. */
export function wantedTexts(topics: ContentForVoice): string[] {
  const content = topics
    .filter((t) => t.active)
    .flatMap((t) => [
      t.name,
      ...t.questions.filter((q) => q.active).flatMap((q) => [q.text, ...q.options.filter((o) => o.active).map((o) => o.label)]),
    ]);
  return [...new Set([...fixedPhrases(), ...content.map(normaliseText)])].filter((text) => text.length > 0);
}
