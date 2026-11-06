// Chart colours. Tab colours are light (dark text sits on them) and fail as line colours, so each
// topic is drawn in the validated categorical slot nearest its tab hue — Essen stays warm, Hausaufgaben
// blue. Slots are taken in fixed order and never repeated. Answer distributions use a blue↔red
// diverging scale with a gray midpoint (both arms validated with the dataviz validator).

const SLOTS = Object.freeze(['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'] as const);

export const INK = Object.freeze({
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#ffffff',
  single: '#2a78d6',
});

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Topic id → chart colour, stable for a given topic order. */
export function chartColours(topics: readonly { topicId: number; color: string }[]): Map<number, string> {
  const free: string[] = [...SLOTS];
  const result = new Map<number, string>();
  for (const topic of topics) {
    const h = hue(topic.color);
    free.sort((a, b) => distance(hue(a), h) - distance(hue(b), h));
    const pick = free.shift() ?? SLOTS[result.size % SLOTS.length] ?? INK.single;
    result.set(topic.topicId, pick);
  }
  return result;
}

/** Answer colours, best first, matching the order of FACES. */
export const ANSWER_COLOURS: Readonly<Record<'scale5' | 'scale3' | 'yesno', readonly string[]>> = Object.freeze({
  scale5: ['#256abf', '#86b6ef', '#d4d3cb', '#f2a19f', '#d64545'],
  scale3: ['#256abf', '#d4d3cb', '#d64545'],
  yesno: ['#256abf', '#d64545'],
});
