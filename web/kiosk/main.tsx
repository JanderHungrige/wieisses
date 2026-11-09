import { render } from 'preact';
import '@fontsource/playpen-sans/latin-400.css';
import '@fontsource/playpen-sans/latin-700.css';
import './kiosk.css';
import './nature.css';
import './springy.css';
import './springy-moves.css';
import './springy-moves-spring.css';
import './speak.css';
import { Kiosk } from './Kiosk.tsx';

const root = document.getElementById('app');
if (root) render(<Kiosk />, root);

// The installable app's service worker (doc 03): only answers failed page loads with the offline
// page. Production only, so the dev server never sits behind it; the kiosk works without it.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
