// A screen's heading with its 🔊 button beside it (outside the heading, so the heading's
// accessible name is just the text).
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
