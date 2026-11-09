// A screen's heading as Springy's speech bubble, with its 🔊 at the bubble's end (outside the
// heading, so the heading's accessible name is just the text), and the 🔊 that sits on or beside a
// tile, tab or button. Every 🔊 is the drawn loudspeaker, makes Springy look at it and pulses its
// waves while its text is read (doc 02).
import { useEffect, useState } from 'preact/hooks';
import { lookAt } from '../lib/springy.ts';
import { isSpeaking, onSpeaking, say } from '../lib/speech.ts';
import { Springy } from './Springy.tsx';

/** Tells Springy where the tapped 🔊 is. */
function lookHere(button: Element): void {
  const box = button.getBoundingClientRect();
  lookAt({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
}

/** True from a 🔊's tap until the speech queue falls silent — or anything else interrupts it. */
function usePlaying(): [boolean, () => void] {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return undefined;
    const off = onSpeaking((speaking) => {
      if (!speaking) setPlaying(false);
    });
    if (!isSpeaking()) setPlaying(false); // it ended before this effect ran
    return off;
  }, [playing]);
  return [playing, () => setPlaying(true)];
}

/** The drawn loudspeaker of every 🔊: ink line, sun-yellow body, two waves — never the emoji. */
function SpeakerIcon() {
  return (
    <svg class="speaker" viewBox="0 0 32 32" aria-hidden="true">
      <path
        class="speaker-body"
        d="M4.6 12.4 L10.2 12 L16.6 6.6 Q18 5.7 18.1 7.3 L18.4 24.7 Q18.3 26.3 16.8 25.4 L10.1 20.2 L4.8 19.8 Q3.7 19.7 3.8 18.5 L3.9 13.6 Q4 12.5 4.6 12.4 Z"
      />
      <path class="speaker-wave" d="M22 11.6 Q25.3 16 22.1 20.6" />
      <path class="speaker-wave wave-2" d="M25.4 7.9 Q31 15.8 25.6 24.3" />
    </svg>
  );
}

type Props = { id: string; text: string; onSpeak?: () => void; class?: string };

export function Prompt({ id, text, onSpeak, class: extra = 'prompt' }: Props) {
  return (
    <div class="prompt-row">
      <Springy size="small" />
      <div class={`${extra} bubble bubble-speak`}>
        <h1 id={id}>{text}</h1>
        <SpeakButton text={text} onSpeak={onSpeak} label="Vorlesen" class="speak-bubble" />
      </div>
    </div>
  );
}

type SpeakProps = { text: string; onSpeak?: () => void; label?: string; class?: string; disabled?: boolean };

/** Only reads `text` aloud — its own button, so listening never picks anything (doc 01, step 3–4). */
export function SpeakButton({ text, onSpeak, label = `Vorlesen: ${text}`, class: extra, disabled = false }: SpeakProps) {
  const [playing, start] = usePlaying();
  const speak = onSpeak ?? (() => say(text, true));
  const classes = ['speak', extra, playing ? 'playing' : undefined].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      class={classes}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        lookHere(e.currentTarget);
        speak();
        start();
      }}
    >
      <SpeakerIcon />
    </button>
  );
}
