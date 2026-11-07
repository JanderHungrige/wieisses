// A screen's heading with its 🔊 button beside it (outside the heading, so the heading's
// accessible name is just the text), and the 🔊 that sits beside a tile, tab or button.
import { say } from '../lib/speech.ts';

type Props = { id: string; text: string; onSpeak?: () => void; class?: string };

export function Prompt({ id, text, onSpeak, class: extra = 'prompt' }: Props) {
  return (
    <div class="prompt-row">
      <h1 id={id} class={extra}>{text}</h1>
      <button type="button" class="speak" aria-label="Vorlesen" onClick={onSpeak ?? (() => say(text, true))}>🔊</button>
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
      onClick={() => say(text, true)}
    >
      🔊
    </button>
  );
}
