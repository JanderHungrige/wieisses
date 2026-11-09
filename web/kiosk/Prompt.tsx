// A screen's heading as Springy's speech bubble, with its 🔊 button beside it (outside the heading,
// so the heading's accessible name is just the text), and the 🔊 that sits beside a tile, tab or
// button. Every 🔊 also makes Springy look at it (doc 02).
import { lookAt } from '../lib/springy.ts';
import { say } from '../lib/speech.ts';
import { Springy } from './Springy.tsx';

/** Tells Springy where the tapped 🔊 is. */
function lookHere(button: Element): void {
  const box = button.getBoundingClientRect();
  lookAt({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
}

type Props = { id: string; text: string; onSpeak?: () => void; class?: string };

export function Prompt({ id, text, onSpeak, class: extra = 'prompt' }: Props) {
  const speak = onSpeak ?? (() => say(text, true));
  return (
    <div class="prompt-row">
      <Springy size="small" />
      <h1 id={id} class={`${extra} bubble`}>{text}</h1>
      <button type="button" class="speak" aria-label="Vorlesen" onClick={(e) => (lookHere(e.currentTarget), speak())}>🔊</button>
    </div>
  );
}

type SpeakProps = { text: string; class?: string; disabled?: boolean };

/** Only reads `text` aloud — its own button, so listening never picks anything (doc 01, step 3–4). */
export function SpeakButton({ text, class: extra, disabled = false }: SpeakProps) {
  return (
    <button
      type="button"
      class={extra ? `speak ${extra}` : 'speak'}
      aria-label={`Vorlesen: ${text}`}
      disabled={disabled}
      onClick={(e) => (lookHere(e.currentTarget), say(text, true))}
    >
      🔊
    </button>
  );
}
