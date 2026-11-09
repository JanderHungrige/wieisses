// Springy — the logo with a face, guiding the children (doc 02). An SVG rig: the logo's swirl as
// the body, googly eyes on its top arc, brows, a mouth. CSS does the motion (springy.css); this
// file only switches states: the mood from the kiosk phase, the greeting move on the start screen,
// talking while the speech queue speaks, and the pupils turned towards a tapped 🔊.
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { isSpeaking, onSpeaking } from '../lib/speech.ts';
import { nextMove, onLook, pupilOffset, type Mood, type Move, type Point } from '../lib/springy.ts';
import { BODY } from './springy-body.ts';

/** The mood of the screen being shown; Kiosk.tsx provides it from `springyMood(phase)`. */
export const SpringyMood = createContext<Mood>('idle');

const EYE_R = 30;
const LOOK_MAX = 12; // SVG units: the pupil (r 13) stays inside the eye (r 30)
const LOOK_MS = 2500;
const EYES: readonly Point[] = [{ x: 122, y: 10 }, { x: 186, y: 15 }];

function useTalking(): boolean {
  const [talking, setTalking] = useState(isSpeaking());
  useEffect(() => onSpeaking(setTalking), []);
  return talking;
}

/** The start screen's move, and the handler that picks the next one when the spring's ends. */
function useGreeting(active: boolean): [Move | undefined, (e: AnimationEvent) => void] {
  const [move, setMove] = useState<Move>(() => nextMove(undefined));
  const next = (e: AnimationEvent) => {
    if (e.target === e.currentTarget) setMove((played) => nextMove(played));
  };
  return [active ? move : undefined, next];
}

/** The pupils' offset in SVG units: towards the last tapped 🔊, back to the middle after a while. */
function useLook(eye: { current: SVGCircleElement | null }): Point {
  const [look, setLook] = useState<Point>({ x: 0, y: 0 });
  useEffect(() => {
    let timer = 0;
    const off = onLook((target) => {
      const box = eye.current?.getBoundingClientRect();
      if (!box || box.width === 0) return;
      const unit = box.width / (2 * EYE_R); // px per SVG unit
      const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const offset = pupilOffset(centre, target, LOOK_MAX * unit);
      setLook({ x: offset.x / unit, y: offset.y / unit });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLook({ x: 0, y: 0 }), LOOK_MS);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [eye]);
  return look;
}

export function Springy({ size }: { size: 'small' | 'big' }) {
  const mood = useContext(SpringyMood);
  const talking = useTalking();
  const firstEye = useRef<SVGCircleElement>(null);
  const look = useLook(firstEye);
  const [move, nextGreeting] = useGreeting(mood === 'hello');
  if (mood === 'hidden') return null;
  return (
    <svg
      class={`springy springy-${size} mood-${mood}`}
      data-talking={talking ? '' : undefined}
      data-move={move}
      viewBox="-8 -54 309 312"
      aria-hidden="true"
      focusable="false"
    >
      <g class="springy-spring" onAnimationEnd={nextGreeting}>
        <path class="springy-body" d={BODY} />
        <g class="springy-brows">
          <path d="M98 -30 Q122 -46 146 -32" />
          <path d="M164 -27 Q188 -42 210 -22" />
        </g>
        <g class="springy-eyes">
          {EYES.map((e, i) => (
            <g class="springy-eye">
              <circle ref={i === 0 ? firstEye : undefined} cx={e.x} cy={e.y} r={EYE_R} class="springy-white" />
              <g class="springy-pupil" style={{ transform: `translate(${look.x}px, ${look.y}px)` }}>
                <g class="springy-glance">
                  <circle cx={e.x} cy={e.y + 2} r="13" />
                  <circle cx={e.x - 5} cy={e.y - 3} r="5" class="springy-shine" />
                </g>
              </g>
            </g>
          ))}
        </g>
        <g class="springy-happy">
          <path d="M106 18 Q122 -2 138 18" />
          <path d="M170 23 Q186 3 202 23" />
        </g>
        <path class="springy-smile" d="M140 56 Q154 69 168 56" />
        <path class="springy-open" d="M139 54 Q154 82 169 54 Q154 61 139 54 Z" />
      </g>
    </svg>
  );
}
