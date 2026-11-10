// Bug 01-B1: the browser's speech synthesis is best effort (doc 01, "Which voice speaks"). A browser
// that throws inside it — Brave on iOS throws from getVoices() on first load — must neither stop
// the kiosk from loading nor jam the speech queue.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BRAVE = "undefined is not an object (evaluating 'Object.getPrototypeOf(voice)')";
type Fail = { voices?: number; speak?: (text: string) => boolean; cancel?: boolean; listen?: boolean };

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function fakeSynth(fail: Fail) {
  const listeners = new Map<string, () => void>();
  const spoken: string[] = [];
  let voiceCalls = 0;
  return {
    spoken,
    listeners,
    getVoices() {
      if (++voiceCalls <= (fail.voices ?? 0)) throw new TypeError(BRAVE);
      return [{ lang: 'de-DE', localService: true, name: 'Anna' }];
    },
    addEventListener(type: string, listener: () => void) {
      if (fail.listen) throw new TypeError(BRAVE);
      listeners.set(type, listener);
    },
    speak(utterance: FakeUtterance) {
      if (fail.speak?.(utterance.text)) throw new TypeError(BRAVE);
      spoken.push(utterance.text);
      queueMicrotask(() => utterance.onend?.());
    },
    cancel() {
      if (fail.cancel) throw new TypeError(BRAVE);
    },
  };
}

/** speech.ts loaded fresh against a browser whose synthesis fails as `fail` says. */
async function load(fail: Fail) {
  const synth = fakeSynth(fail);
  vi.stubGlobal('window', { speechSynthesis: synth, setTimeout, clearTimeout });
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.resetModules();
  return { synth, speech: await import('../../web/lib/speech.ts') };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.unstubAllGlobals());

describe('speech.ts with a browser whose synthesis throws', () => {
  it('loads without a voice when getVoices() throws, and picks one up on voiceschanged', async () => {
    const { synth, speech } = await load({ voices: 1 });
    expect(() => speech.initSpeech(0.9, {})).not.toThrow();
    expect(speech.hasGermanVoice()).toBe(false);
    synth.listeners.get('voiceschanged')?.();
    expect(speech.hasGermanVoice()).toBe(true);
  });

  it('loads even when the browser refuses the voiceschanged listener', async () => {
    const { speech } = await load({ listen: true });
    expect(() => speech.initSpeech(0.9, {})).not.toThrow();
    expect(speech.hasGermanVoice()).toBe(true);
  });

  it('skips a text the browser refuses to speak and goes on with the next at once', async () => {
    const { synth, speech } = await load({ speak: (text) => text === 'Hallo' });
    speech.initSpeech(0.9, {});
    expect(() => speech.say('Hallo')).not.toThrow();
    expect(speech.isSpeaking()).toBe(false);
    speech.say('Wie geht es dir?');
    await settle();
    expect(synth.spoken).toEqual(['Wie geht es dir?']);
    expect(speech.isSpeaking()).toBe(false);
  });

  it('unlocks and stops without throwing when speak() and cancel() throw', async () => {
    const { speech } = await load({ speak: () => true, cancel: true });
    speech.initSpeech(0.9, {});
    expect(() => speech.unlockAudio()).not.toThrow();
    expect(() => speech.stopSpeech()).not.toThrow();
  });
});
