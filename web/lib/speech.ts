// Reading aloud: the tablet's German voice through speechSynthesis, or an uploaded recording
// when the question has one (doc 01, "The child's flow").

let rate = 0.9;
let voice: SpeechSynthesisVoice | undefined;
let playing: HTMLAudioElement | undefined;

const synth = (): SpeechSynthesis | undefined => ('speechSynthesis' in window ? window.speechSynthesis : undefined);

function chooseVoice(): void {
  const voices = synth()?.getVoices() ?? [];
  const german = voices.filter((v) => v.lang.toLowerCase().startsWith('de'));
  voice = german.find((v) => v.localService && v.lang === 'de-DE') ?? german.find((v) => v.lang === 'de-DE') ?? german[0];
}

export function initSpeech(speechRate: number): void {
  rate = speechRate;
  chooseVoice();
  synth()?.addEventListener('voiceschanged', chooseVoice);
}

export function hasGermanVoice(): boolean {
  return voice !== undefined;
}

export function stopSpeech(): void {
  synth()?.cancel();
  if (playing) {
    playing.pause();
    playing = undefined;
  }
}

/** Speaks `text`. `interrupt` cuts off what is being said; otherwise it is queued after it. */
export function say(text: string, interrupt = false): void {
  const s = synth();
  if (!s) return;
  if (interrupt) stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = rate;
  if (voice) utterance.voice = voice;
  s.speak(utterance);
}

/** A question: its recording if there is one, otherwise its text (queued unless `interrupt`). */
export function sayQuestion(text: string, audioUrl: string | null, interrupt = true): void {
  if (!audioUrl) {
    say(text, interrupt);
    return;
  }
  stopSpeech();
  playing = new Audio(audioUrl);
  playing.play().catch(() => say(text, true));
}
