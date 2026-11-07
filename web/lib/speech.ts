// Reading aloud (doc 01, "Which voice speaks"): a question's own recording, else its Thorsten
// clip, else — only while a clip is missing — the tablet's German voice. One queue for all three,
// so a new prompt either waits for the current one or interrupts it.
import { normaliseText } from '../../shared/phrases.ts';
import { createClipCache } from './clip-cache.ts';

type Item = { kind: 'audio'; url: string } | { kind: 'tts'; text: string };

let rate = 0.9;
let voice: SpeechSynthesisVoice | undefined;
let clips: Record<string, string> = {};
const held = createClipCache();
let queue: Item[] = [];
let busy = false;
let turn = 0; // ignores late "ended" events from something that was interrupted
const player = typeof Audio === 'undefined' ? undefined : new Audio();

const synth = (): SpeechSynthesis | undefined => ('speechSynthesis' in window ? window.speechSynthesis : undefined);

function chooseVoice(): void {
  const german = (synth()?.getVoices() ?? []).filter((v) => v.lang.toLowerCase().startsWith('de'));
  voice = german.find((v) => v.localService && v.lang === 'de-DE') ?? german.find((v) => v.lang === 'de-DE') ?? german[0];
}

/** 50 ms of silence as a WAV blob — played inside a tap so iOS lets the page play audio later. */
function silence(): string {
  const samples = 400;
  const view = new DataView(new ArrayBuffer(44 + samples));
  const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([view.buffer], { type: 'audio/wav' }));
}

export function initSpeech(speechRate: number, voiceClips: Record<string, string> = {}): void {
  rate = speechRate;
  clips = voiceClips;
  void held.prefetch(Object.values(voiceClips));
  chooseVoice();
  synth()?.addEventListener('voiceschanged', chooseVoice);
}

/** Call from inside a tap handler ("Los geht's"): unlocks audio and speech on iOS. */
export function unlockAudio(): void {
  if (player) {
    player.src = silence();
    player.play().catch(() => undefined);
  }
  synth()?.speak(new SpeechSynthesisUtterance(''));
}

export function hasGermanVoice(): boolean {
  return voice !== undefined;
}

function next(): void {
  if (busy) return;
  const item = queue.shift();
  if (!item) return;
  busy = true;
  const mine = ++turn;
  const done = () => {
    if (mine !== turn) return;
    busy = false;
    next();
  };
  // A watchdog, because "ended" events are not guaranteed on every tablet browser.
  const guard = window.setTimeout(done, item.kind === 'tts' ? 2000 + (item.text.length * 110) / rate : 30_000);
  const finish = () => (window.clearTimeout(guard), done());
  if (item.kind === 'audio') play(item.url, finish);
  else speak(item.text, finish);
}

function play(url: string, finish: () => void): void {
  if (!player) return finish();
  player.onended = finish;
  player.onerror = finish;
  player.src = held.resolve(url);
  player.play().catch(finish);
}

function speak(text: string, finish: () => void): void {
  const s = synth();
  if (!s) return finish();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = rate;
  if (voice) utterance.voice = voice;
  utterance.onend = finish;
  utterance.onerror = finish;
  s.speak(utterance);
}

const itemFor = (text: string): Item => {
  const url = clips[normaliseText(text)];
  return url ? { kind: 'audio', url } : { kind: 'tts', text };
};

export function stopSpeech(): void {
  queue = [];
  busy = false;
  turn++;
  synth()?.cancel();
  if (player) {
    player.onended = null;
    player.onerror = null;
    player.pause();
  }
}

/** Speaks the parts one after another. `interrupt` cuts off what is being said. */
export function sayParts(texts: readonly string[], interrupt = false): void {
  if (interrupt) stopSpeech();
  queue.push(...texts.map(itemFor));
  next();
}

export function say(text: string, interrupt = false): void {
  sayParts([text], interrupt);
}

/** A question: its own recording if there is one, else its Thorsten clip, else the tablet voice. */
export function sayQuestion(text: string, audioUrl: string | null, interrupt = true): void {
  if (interrupt) stopSpeech();
  queue.push(audioUrl ? { kind: 'audio', url: audioUrl } : itemFor(text));
  next();
}
