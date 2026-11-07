// One topic's questions, one per screen: picture, text, 🔊, big answers, "Überspringen".
// Every answer has its own 🔊; tapping an answer speaks nothing (doc 01, step 4).
// The answers are handed in together after the last question.
import { useEffect, useState } from 'preact/hooks';
import { FACES } from '../../shared/catalog.ts';
import type { AnswerInput, KioskQuestion, KioskTopic } from '../../shared/schema.ts';
import { PHRASE } from '../../shared/phrases.ts';
import { sayQuestion, stopSpeech } from '../lib/speech.ts';
import { Prompt, SpeakButton } from './Prompt.tsx';

type Props = { topic: KioskTopic; autoRead: boolean; onFinish: (answers: AnswerInput[]) => void };

const ADVANCE_MS = 900;

export function QuestionFlow({ topic, autoRead, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerInput[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [chosen, setChosen] = useState<string | null>(null); // the tapped single answer, shown until the next question
  const [locked, setLocked] = useState(false);
  const question = topic.questions[index];

  useEffect(() => {
    if (question && autoRead) sayQuestion(question.text, question.audioUrl, false);
  }, [question, autoRead]);

  if (!question) return null;

  function advance(next: AnswerInput[]): void {
    setLocked(true);
    window.setTimeout(() => {
      setLocked(false);
      setPicked([]);
      setChosen(null);
      if (index + 1 >= topic.questions.length) onFinish(next);
      else {
        setAnswers(next);
        setIndex(index + 1);
      }
    }, ADVANCE_MS);
  }

  function answer(input: AnswerInput, tile: string | null): void {
    stopSpeech();
    setChosen(tile);
    advance([...answers, input]);
  }

  function toggle(optionId: number): void {
    stopSpeech();
    setPicked(picked.includes(optionId) ? picked.filter((id) => id !== optionId) : [...picked, optionId]);
  }

  return (
    <section class="question" aria-labelledby="question-text">
      <Progress count={topic.questions.length} at={index} />
      <Picture imageUrl={question.imageUrl} icon={question.icon} />
      <Prompt id="question-text" class="question-text" text={question.text} onSpeak={() => sayQuestion(question.text, question.audioUrl)} />
      <Answers question={question} picked={picked} chosen={chosen} locked={locked} onAnswer={answer} onToggle={toggle} />
      <div class="question-actions">
        {question.kind === 'choice' && question.multi && (
          <span class="action-slot">
            <button
              type="button"
              class="done-button"
              disabled={locked || picked.length === 0}
              onClick={() => answer({ questionId: question.id, optionIds: picked }, null)}
            >
              Fertig ✓
            </button>
            <SpeakButton text={PHRASE.done} disabled={locked} />
          </span>
        )}
        <span class="action-slot">
          <button type="button" class="skip" disabled={locked} onClick={() => (stopSpeech(), advance(answers))}>
            Überspringen ⏭
          </button>
          <SpeakButton text={PHRASE.skip} disabled={locked} />
        </span>
      </div>
    </section>
  );
}

function Progress({ count, at }: { count: number; at: number }) {
  return (
    <ol class="progress" aria-label={`Frage ${at + 1} von ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <li class={i < at ? 'dot-done' : i === at ? 'dot-now' : ''} aria-hidden="true" />
      ))}
    </ol>
  );
}

export function Picture({ imageUrl, icon, small = false }: { imageUrl: string | null; icon: string; small?: boolean }) {
  if (imageUrl) return <img class={small ? 'pic small' : 'pic'} src={imageUrl} alt="" width={small ? 72 : 180} height={small ? 72 : 180} />;
  return <span class={small ? 'emoji small' : 'emoji'} aria-hidden="true">{icon}</span>;
}

type AnswersProps = {
  question: KioskQuestion;
  picked: number[];
  chosen: string | null;
  locked: boolean;
  onAnswer: (input: AnswerInput, tile: string) => void;
  onToggle: (optionId: number) => void;
};

function Answers({ question, picked, chosen, locked, onAnswer, onToggle }: AnswersProps) {
  if (question.kind !== 'choice') {
    return (
      <div class={`answers faces faces-${FACES[question.kind].length}`}>
        {FACES[question.kind].map((face) => (
          <div class="tile-slot">
            <button
              type="button"
              class={chosen === `v${face.value}` ? 'tile face picked' : 'tile face'}
              style={{ background: face.tint }}
              disabled={locked}
              onClick={() => onAnswer({ questionId: question.id, value: face.value }, `v${face.value}`)}
            >
              <span class="big" aria-hidden="true">{face.emoji}</span>
              <span class="label">{face.label}</span>
            </button>
            <SpeakButton text={face.label} class="speak-corner" disabled={locked} />
          </div>
        ))}
      </div>
    );
  }
  const count = question.options.length;
  const columns = count <= 4 ? count : count <= 8 ? 4 : 6;
  return (
    <div class="answers options" style={{ '--cols': columns }}>
      {question.options.map((option) => {
        const on = picked.includes(option.id) || chosen === `o${option.id}`;
        const click = () =>
          question.multi ? onToggle(option.id) : onAnswer({ questionId: question.id, optionIds: [option.id] }, `o${option.id}`);
        return (
          <div class="tile-slot">
            <button type="button" class={on ? 'tile option picked' : 'tile option'} aria-pressed={question.multi ? on : undefined} disabled={locked} onClick={click}>
              <Picture imageUrl={option.imageUrl} icon={option.icon} small />
              <span class="label">{option.label}</span>
              {on && <span class="check" aria-hidden="true">✓</span>}
            </button>
            <SpeakButton text={option.label} class="speak-corner" disabled={locked} />
          </div>
        );
      })}
    </div>
  );
}
