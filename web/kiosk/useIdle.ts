// Calls `onIdle` after `seconds` without a touch, click or key while `active` — the next child
// must never find the previous child's session (doc 01, step 6).
import { useEffect, useRef } from 'preact/hooks';

export function useIdle(seconds: number, active: boolean, onIdle: () => void): void {
  const callback = useRef(onIdle);
  callback.current = onIdle;

  useEffect(() => {
    if (!active) return undefined;
    let timer = window.setTimeout(() => callback.current(), seconds * 1000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current(), seconds * 1000);
    };
    const events = ['pointerdown', 'keydown', 'wheel'] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [seconds, active]);
}
