// The picture code, one step per screen: animal → colour → fruit (→ grade for a new child).
// Every prompt and every pick is read aloud (doc 01, "The child's flow" step 2).
import { useEffect, useState } from 'preact/hooks';
import { ANIMALS, COLOURS, FRUITS, animal, colour, fruit, type CodePicks } from '../../shared/catalog.ts';
import { say } from '../lib/speech.ts';
import { Prompt } from './Prompt.tsx';

type Step = 'animal' | 'color' | 'fruit' | 'grade';
type Props = {
  mode: 'new' | 'returning';
  grades: number[];
  /** Resolves to an error message to show, or null when the code was accepted. */
  onComplete: (picks: CodePicks, grade: number | null) => Promise<string | null>;
};

const PROMPTS: Record<'new' | 'returning', Record<Step, string>> = {
  new: {
    animal: 'Such dir ein Tier aus!',
    color: 'Jetzt eine Farbe!',
    fruit: 'Und jetzt ein Obst!',
    grade: 'In welche Klasse gehst du?',
  },
  returning: {
    animal: 'Welches Tier ist in deinem Geheimzeichen?',
    color: 'Welche Farbe?',
    fruit: 'Welches Obst?',
    grade: '',
  },
};

export function CodePicker({ mode, grades, onComplete }: Props) {
  const [step, setStep] = useState<Step>('animal');
  const [picks, setPicks] = useState<Partial<CodePicks>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const prompt = PROMPTS[mode][step];

  useEffect(() => say(prompt), [prompt]);

  async function finish(done: CodePicks, grade: number | null): Promise<void> {
    setBusy(true);
    const message = await onComplete(done, grade);
    setBusy(false);
    if (message === null) return;
    setError(message);
    say(message, true);
    setPicks({ animal: done.animal, color: done.color });
    setStep('fruit');
  }

  function pick(key: 'animal' | 'color' | 'fruit', id: string, name: string): void {
    say(name, true);
    setError(null);
    const next = { ...picks, [key]: id };
    setPicks(next);
    if (key === 'animal') setStep('color');
    else if (key === 'color') setStep('fruit');
    else if (mode === 'new') setStep('grade');
    else void finish(next as CodePicks, null);
  }

  function back(): void {
    setError(null);
    if (step === 'color') setStep('animal');
    if (step === 'fruit') setStep('color');
    if (step === 'grade') setStep('fruit');
  }

  return (
    <section class="picker" aria-labelledby="picker-title">
      <Slots picks={picks} />
      <Prompt id="picker-title" text={prompt} />
      {error && <p class="notice" role="alert">{error}</p>}
      <Choices step={step} grades={grades} busy={busy} onPick={pick} onGrade={(g) => void finish(picks as CodePicks, g)} />
      {step !== 'animal' && (
        <button type="button" class="back" onClick={back} disabled={busy}>⬅ Zurück</button>
      )}
    </section>
  );
}

function Slots({ picks }: { picks: Partial<CodePicks> }) {
  const a = picks.animal ? animal(picks.animal) : undefined;
  const c = picks.color ? colour(picks.color) : undefined;
  const f = picks.fruit ? fruit(picks.fruit) : undefined;
  return (
    <div class="slots" aria-label="Dein Zeichen bis jetzt">
      <span class={a ? 'slot filled' : 'slot'}>{a ? <span aria-label={a.name}>{a.emoji}</span> : '?'}</span>
      <span class={c ? 'slot filled' : 'slot'}>{c ? <span class="dot" aria-label={c.name} style={{ background: c.hex }} /> : '?'}</span>
      <span class={f ? 'slot filled' : 'slot'}>{f ? <span aria-label={f.name}>{f.emoji}</span> : '?'}</span>
    </div>
  );
}

type ChoicesProps = {
  step: Step;
  grades: number[];
  busy: boolean;
  onPick: (key: 'animal' | 'color' | 'fruit', id: string, name: string) => void;
  onGrade: (grade: number) => void;
};

function Choices({ step, grades, busy, onPick, onGrade }: ChoicesProps) {
  if (step === 'grade') {
    return (
      <div class="grid grades">
        {grades.map((g) => (
          <button type="button" class="tile grade" disabled={busy} onClick={() => (say(`Klasse ${g}`, true), onGrade(g))}>
            <span class="big">{g}</span>
            <span class="label">Klasse {g}</span>
          </button>
        ))}
      </div>
    );
  }
  if (step === 'color') {
    return (
      <div class="grid colours">
        {COLOURS.map((c) => (
          <button type="button" class="tile" disabled={busy} onClick={() => onPick('color', c.id, c.name)}>
            <span class="dot big-dot" style={{ background: c.hex }} aria-hidden="true" />
            <span class="label">{c.name}</span>
          </button>
        ))}
      </div>
    );
  }
  const list = step === 'animal' ? ANIMALS : FRUITS;
  return (
    <div class={step === 'animal' ? 'grid pictures animals' : 'grid pictures fruits'}>
      {list.map((p) => (
        <button type="button" class="tile" disabled={busy} onClick={() => onPick(step, p.id, p.name)}>
          <span class="big" aria-hidden="true">{p.emoji}</span>
          <span class="label">{p.name}</span>
        </button>
      ))}
    </div>
  );
}
