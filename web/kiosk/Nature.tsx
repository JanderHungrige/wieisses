// The meadow behind every screen (doc 02, "Nature background"): the painted backdrop (nature.css)
// and, drawn over it in the same ink, drifting clouds, a sun with turning rays and two butterflies.
// Decoration only — hidden from screen readers, never in the way of a tap; the sun's admin gate is
// a separate link in the kiosk layer (Kiosk.tsx, nature.css).

const CLOUD = 'M34 78c-22 0-30-21-15-32-2-19 22-29 37-17 6-24 48-28 59-5 17-11 42-1 41 17 21 3 24 37-1 37z';

function Cloud({ name }: { name: string }) {
  return (
    <svg class={`cloud ${name}`} viewBox="0 0 186 86">
      <path d={CLOUD} fill="#fff" stroke="#36505e" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M40 70c18 4 64 5 104 0" fill="none" stroke="#d6e6ee" stroke-width="5" stroke-linecap="round" />
    </svg>
  );
}

function Sun() {
  const rays = Array.from({ length: 10 }, (_, i) => i * 36);
  return (
    <svg class="sun" viewBox="-60 -60 120 120">
      <g class="sun-rays" stroke="#e8a317" stroke-width="5" stroke-linecap="round">
        {rays.map((deg) => (
          <line x1="0" y1="-36" x2="0" y2="-52" transform={`rotate(${deg})`} />
        ))}
      </g>
      <circle r="27" fill="#ffd54a" stroke="#8a5a00" stroke-width="2.5" />
    </svg>
  );
}

function Butterfly({ name, wing }: { name: string; wing: string }) {
  return (
    <div class={`butterfly ${name}`}>
      <svg viewBox="-24 -20 48 40">
        <g class="wing wing-left">
          <path d="M-2 -2C-14 -20-26-12-20 0-26 10-12 18-2 4Z" fill={wing} stroke="#3a2a1a" stroke-width="1.6" />
        </g>
        <g class="wing wing-right">
          <path d="M2 -2C14 -20 26-12 20 0 26 10 12 18 2 4Z" fill={wing} stroke="#3a2a1a" stroke-width="1.6" />
        </g>
        <path d="M0-9V11" stroke="#3a2a1a" stroke-width="3" stroke-linecap="round" />
      </svg>
    </div>
  );
}

export function Nature() {
  return (
    <div class="nature" aria-hidden="true">
      <Sun />
      <Cloud name="cloud-1" />
      <Cloud name="cloud-2" />
      <Cloud name="cloud-3" />
      <Butterfly name="butterfly-1" wing="#f4a03a" />
      <Butterfly name="butterfly-2" wing="#e7709b" />
    </div>
  );
}
