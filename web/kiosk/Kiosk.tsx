// The kiosk page: header with the coloured topic tabs and "Tschüss", and the current screen.
import type { KioskTopic } from '../../shared/schema.ts';
import { PHRASE } from '../../shared/phrases.ts';
import { say, unlockAudio } from '../lib/speech.ts';
import { CodePicker } from './CodePicker.tsx';
import { QuestionFlow } from './QuestionFlow.tsx';
import * as S from './screens.tsx';
import { SpeakButton } from './Prompt.tsx';
import { RESTING, useKiosk } from './useKiosk.ts';

type K = ReturnType<typeof useKiosk>;

export function Kiosk() {
  const k = useKiosk();
  const { config, phase, session } = k;
  const activeId = phase.name === 'topics' ? phase.topicId : null;
  const active = config?.topics.find((t) => t.id === activeId);
  const showTabs = config && session && (phase.name === 'topics' || phase.name === 'thanks');

  return (
    <div class="kiosk" style={{ '--topic': active?.color ?? '#fff8ec' }}>
      <header class="bar">
        {showTabs ? (
          <TopicTabs topics={config.topics} done={session.done} activeId={activeId} onPick={k.openTopic} />
        ) : (
          <span class="bar-title">{phase.name === 'start' ? '' : (config?.title ?? 'Wie isses?')}</span>
        )}
        {!RESTING.has(phase.name) && (
          <button type="button" class="bye" onClick={() => (say(PHRASE.bye, true), k.reset())}>Tschüss 👋</button>
        )}
      </header>
      <main class="stage">
        <Screen k={k} active={active} />
      </main>
    </div>
  );
}

function Screen({ k, active }: { k: K; active: KioskTopic | undefined }) {
  const { config, phase, session } = k;
  if (phase.name === 'unregistered') return <S.UnregisteredScreen />;
  if (phase.name === 'offline') return <S.OfflineScreen message={phase.message} onRetry={() => void k.load()} />;
  if (!config || phase.name === 'loading') return <p class="loading">Einen Moment …</p>;
  switch (phase.name) {
    case 'start':
      return <S.StartScreen title={config.title} onStart={() => (unlockAudio(), k.setPhase({ name: 'ask' }))} />;
    case 'ask':
      return <S.AskScreen onChoose={(mode) => k.setPhase({ name: 'pick', mode })} />;
    case 'pick':
      return <CodePicker key={phase.mode} mode={phase.mode} grades={config.settings.grades} onComplete={(p, g) => k.enterCode(phase.mode, p, g)} />;
    case 'unknown':
      return <S.UnknownCodeScreen onRetry={() => k.setPhase({ name: 'pick', mode: 'returning' })} onNew={() => k.setPhase({ name: 'pick', mode: 'new' })} />;
    case 'welcome':
      return <S.WelcomeScreen picks={phase.picks} onOk={() => k.setPhase({ name: 'topics', topicId: null })} />;
    case 'thanks':
      return <S.ThanksScreen all={phase.all} />;
    case 'topics':
      if (!session) return null;
      if (!active) return <S.TopicHome topics={config.topics} done={session.done} onPick={k.openTopic} />;
      if (session.done.includes(active.id)) return <S.AlreadyDone topic={active} />;
      return <QuestionFlow key={active.id} topic={active} autoRead={config.settings.autoRead} onFinish={(a) => void k.submit(active, a)} />;
    default:
      throw new Error(`unhandled phase: ${phase satisfies never}`);
  }
}

type TabsProps = { topics: KioskTopic[]; done: number[]; activeId: number | null; onPick: (t: KioskTopic) => void };

function TopicTabs({ topics, done, activeId, onPick }: TabsProps) {
  return (
    <nav class="tabs" aria-label="Themen">
      {topics.map((t) => (
        <div class={t.id === activeId ? 'tab-slot active' : 'tab-slot'} style={{ background: t.color }}>
          <button type="button" class="tab" aria-current={t.id === activeId ? 'page' : undefined} onClick={() => onPick(t)}>
            <span class="tab-icon" aria-hidden="true">{t.icon}</span>
            <span class="tab-name">{t.name}</span>
            {done.includes(t.id) && <span class="tab-check" aria-label="erledigt">✓</span>}
          </button>
          <SpeakButton text={t.name} class="speak-tab" />
        </div>
      ))}
    </nav>
  );
}
