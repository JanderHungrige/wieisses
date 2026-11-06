// The kiosk's simple screens: start, "new or not", the new sign, messages, thanks.
import { useEffect } from 'preact/hooks';
import { animal, colour, fruit, type CodePicks } from '../../shared/catalog.ts';
import { PHRASE } from '../../shared/phrases.ts';
import type { KioskTopic } from '../../shared/schema.ts';
import { say, sayParts } from '../lib/speech.ts';
import { Prompt } from './Prompt.tsx';
import { Picture } from './QuestionFlow.tsx';

/** Speaks `text` once when the screen appears. */
function useSay(text: string): void {
  useEffect(() => say(text), [text]);
}

export function StartScreen({ title, onStart }: { title: string; onStart: () => void }) {
  return (
    <section class="center start" aria-labelledby="start-title">
      <p class="hello" aria-hidden="true">👋😊</p>
      <h1 id="start-title" class="title">{title}</h1>
      <button type="button" class="primary huge" onClick={onStart}>Los geht's ▶</button>
    </section>
  );
}

export function AskScreen({ onChoose }: { onChoose: (mode: 'new' | 'returning') => void }) {
  const text = PHRASE.askSign;
  useSay(text);
  return (
    <section class="center" aria-labelledby="ask-title">
      <Prompt id="ask-title" text={text} />
      <div class="two">
        <button type="button" class="tile choice-card" onClick={() => onChoose('returning')}>
          <span class="big" aria-hidden="true">🔑</span>
          <span class="label">Ja, ich habe eins</span>
        </button>
        <button type="button" class="tile choice-card" onClick={() => onChoose('new')}>
          <span class="big" aria-hidden="true">✨</span>
          <span class="label">Ich bin neu</span>
        </button>
      </div>
    </section>
  );
}

export function WelcomeScreen({ picks, onOk }: { picks: CodePicks; onOk: () => void }) {
  const c = colour(picks.color);
  // Spoken in fixed parts, so every part has a Thorsten clip (doc 01, "Fixed kiosk phrases").
  useEffect(() => {
    const parts = [animal(picks.animal)?.name, colour(picks.color)?.name, fruit(picks.fruit)?.name];
    sayParts([PHRASE.newSign, ...parts.filter((p): p is string => p !== undefined), PHRASE.remember]);
  }, [picks]);
  return (
    <section class="center" aria-labelledby="welcome-title">
      <h1 id="welcome-title" class="prompt">Das ist jetzt dein Geheimzeichen!</h1>
      <div class="code-card">
        <span class="code-part"><span class="big" aria-hidden="true">{animal(picks.animal)?.emoji}</span>{animal(picks.animal)?.name}</span>
        <span class="code-part"><span class="dot big-dot" style={{ background: c?.hex }} aria-hidden="true" />{c?.name}</span>
        <span class="code-part"><span class="big" aria-hidden="true">{fruit(picks.fruit)?.emoji}</span>{fruit(picks.fruit)?.name}</span>
      </div>
      <p class="hint">Merk es dir gut!</p>
      <button type="button" class="primary huge" onClick={onOk}>Verstanden 👍</button>
    </section>
  );
}

export function UnknownCodeScreen({ onRetry, onNew }: { onRetry: () => void; onNew: () => void }) {
  const text = PHRASE.unknownSign;
  useSay(text);
  return (
    <section class="center" aria-labelledby="unknown-title">
      <p class="hello" aria-hidden="true">🤔</p>
      <h1 id="unknown-title" class="prompt">{text}</h1>
      <div class="two">
        <button type="button" class="tile choice-card" onClick={onRetry}>
          <span class="big" aria-hidden="true">🔁</span>
          <span class="label">Nochmal</span>
        </button>
        <button type="button" class="tile choice-card" onClick={onNew}>
          <span class="big" aria-hidden="true">✨</span>
          <span class="label">Ich bin neu</span>
        </button>
      </div>
    </section>
  );
}

export function TopicHome({ topics, done, onPick }: { topics: KioskTopic[]; done: number[]; onPick: (t: KioskTopic) => void }) {
  const text = PHRASE.chooseTopic;
  useSay(text);
  return (
    <section class="topic-home" aria-labelledby="home-title">
      <Prompt id="home-title" text={text} />
      <div class="grid topics-grid">
        {topics.map((t) => (
          <button type="button" class="tile topic-tile" style={{ background: t.color }} onClick={() => onPick(t)}>
            <Picture imageUrl={t.imageUrl} icon={t.icon} small />
            <span class="label">{t.name}</span>
            {done.includes(t.id) && <span class="check" aria-label="schon erledigt">✓</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

export function AlreadyDone({ topic }: { topic: KioskTopic }) {
  useSay(PHRASE.alreadyDone);
  return (
    <section class="center" aria-labelledby="done-title">
      <p class="hello" aria-hidden="true">✅</p>
      <h1 id="done-title" class="prompt">Das hast du heute schon gemacht.</h1>
      <p class="hint">{topic.name}: Morgen wieder!</p>
    </section>
  );
}

export function ThanksScreen({ all }: { all: boolean }) {
  useSay(all ? PHRASE.allDone : PHRASE.thanks);
  return (
    <section class="center thanks" aria-labelledby="thanks-title">
      <div class="confetti" aria-hidden="true">
        {['🎉', '⭐', '🎈', '💛', '🌟', '🎊'].map((e, i) => <span style={{ animationDelay: `${i * 0.12}s` }}>{e}</span>)}
      </div>
      <h1 id="thanks-title" class="title">{all ? 'Alles geschafft!' : 'Danke!'}</h1>
      {all && <p class="hint">Tschüss! 👋</p>}
    </section>
  );
}

export function UnregisteredScreen() {
  return (
    <section class="center adult" aria-labelledby="unreg-title">
      <p class="hello" aria-hidden="true">🔒</p>
      <h1 id="unreg-title" class="prompt">Dieses Tablet ist noch nicht freigeschaltet.</h1>
      <p class="hint">
        Eine erwachsene Person kann es im Admin-Bereich unter „Tablets“ freischalten – direkt auf diesem Tablet.
      </p>
      <a class="primary" href="/admin/#/tablets">Zum Admin-Bereich</a>
    </section>
  );
}

export function OfflineScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section class="center adult" aria-labelledby="offline-title">
      <p class="hello" aria-hidden="true">📡</p>
      <h1 id="offline-title" class="prompt">{message}</h1>
      <button type="button" class="primary" onClick={onRetry}>Nochmal versuchen</button>
    </section>
  );
}
