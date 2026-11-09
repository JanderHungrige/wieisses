// Springy, the logo as the kiosk's guide (doc 02): the mood a screen gives it, where its pupils
// look, and the tapped 🔊 it should look at. Pure — the SVG and its motion live in web/kiosk/.

/** The kiosk's phases (web/kiosk/useKiosk.ts) by name; kept here so this file needs no DOM. */
export type PhaseName = 'loading' | 'unregistered' | 'offline' | 'start' | 'ask' | 'pick' | 'unknown' | 'welcome' | 'topics' | 'thanks';
export type Mood = 'hello' | 'idle' | 'cheer' | 'hidden';
export type Point = { x: number; y: number };

export function springyMood(phase: PhaseName): Mood {
  switch (phase) {
    case 'start':
      return 'hello';
    case 'ask':
    case 'pick':
    case 'unknown':
    case 'welcome':
    case 'topics':
      return 'idle';
    case 'thanks':
      return 'cheer';
    case 'loading':
    case 'unregistered':
    case 'offline':
      return 'hidden';
    default:
      throw new Error(`unhandled: ${phase satisfies never}`);
  }
}

/** How far the pupils move from `eye` towards `target`: the way there, at most `max` long. */
export function pupilOffset(eye: Point, target: Point, max: number): Point {
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) return { x: 0, y: 0 };
  const scale = Math.min(1, max / length);
  return { x: dx * scale, y: dy * scale };
}

type Listener = (target: Point) => void;
const listeners = new Set<Listener>();

/** Springy listens for the 🔊 a child taps; returns the unsubscribe. */
export function onLook(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A 🔊 at `target` (page coordinates of its centre) was tapped. */
export function lookAt(target: Point): void {
  for (const listener of listeners) listener(target);
}
