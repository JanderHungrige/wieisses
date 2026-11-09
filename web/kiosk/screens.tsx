// The kiosk's simple screens: start, "new or not", the new sign, messages, thanks.
import { useEffect } from 'preact/hooks';
import { animal, colour, fruit, type CodePicks } from '../../shared/catalog.ts';
import { PHRASE } from '../../shared/phrases.ts';
import type { KioskTopic } from '../../shared/schema.ts';
import { say, sayParts, stopSpeech } from '../lib/speech.ts';
import { Prompt, SpeakButton } from './Prompt.tsx';
import { Picture } from './QuestionFlow.tsx';
import { Springy } from './Springy.tsx';

/** Speaks `text` once when the screen appears. */
function useSay(text: string): void {
  useEffect(() => say(text), [text]);
}

/** A big choice card with its own 🔊 in the corner (doc 01, step 2): the card itself speaks nothing. */
function ChoiceCard({ icon, label, onPick }: { icon: string; label: string; onPick: () => void }) {
  return (
    <div class="tile-slot">
      <button type="button" class="tile choice-card" onClick={() => (stopSpeech(), onPick())}>
        <span class="big" aria-hidden="true">{icon}</span>
        <span class="label">{label}</span>
      </button>
      <SpeakButton text={label} class="speak-corner" />
    </div>
  );
}

// Springy greets in a bubble; it is not spoken here — audio is locked until "Los geht's" (doc 02).
export function StartScreen({ title, onStart }: { title: string; onStart: () => void }) {
  return (
    <section class="center start" aria-labelledby="start-title">
      <div class="springy-greeting">
        <Springy size="big" />
        <p class="bubble greeting">{PHRASE.springyHello}</p>
      </div>
      <h1 id="start-title" class="title">{title}</h1>
      <button type="button" class="primary huge" onClick={onStart}>Los geht's ▶</button>
    </section>
  );
}

export function AskScreen({ onChoose }: { onChoose: (mode: 'new' | 'returning') => void }) {
  const text = PHRASE.askSign;
  // The first thing a child hears: Springy says hello, then asks (doc 02, "What Springy says").
  useEffect(() => sayParts([PHRASE.springyHello, text]), [text]);
  return (
    <section class="center" aria-labelledby="ask-title">
      <Prompt id="ask-title" text={text} />
      <div class="two">
        <ChoiceCard icon="🔑" label={PHRASE.haveSign} onPick={() => onChoose('returning')} />
        <ChoiceCard icon="✨" label={PHRASE.newHere} onPick={() => onChoose('new')} />
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
      <div class="prompt-row">
        <Springy size="small" />
        <h1 id="welcome-title" class="prompt bubble">Das ist jetzt dein Geheimzeichen!</h1>
      </div>
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
      <div class="prompt-row">
        <Springy size="small" />
        <h1 id="unknown-title" class="prompt bubble">{text}</h1>
      </div>
      <div class="two">
        <ChoiceCard icon="🔁" label={PHRASE.retry} onPick={onRetry} />
        <ChoiceCard icon="✨" label={PHRASE.newHere} onPick={onNew} />
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
          <div class="tile-slot">
            <button type="button" class="tile topic-tile" style={{ background: t.color }} onClick={() => onPick(t)}>
              <Picture imageUrl={t.imageUrl} icon={t.icon} small />
              <span class="label">{t.name}</span>
              {done.includes(t.id) && <span class="check" aria-label="schon erledigt">✓</span>}
            </button>
            <SpeakButton text={t.name} class="speak-corner" />
          </div>
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
      <Prompt id="done-title" text="Das hast du heute schon gemacht." onSpeak={() => say(PHRASE.alreadyDone, true)} />
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
      <Springy size="big" />
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
