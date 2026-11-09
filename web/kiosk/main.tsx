import { render } from 'preact';
import '@fontsource/playpen-sans/latin-400.css';
import '@fontsource/playpen-sans/latin-700.css';
import './kiosk.css';
import './nature.css';
import './springy.css';
import './speak.css';
import { Kiosk } from './Kiosk.tsx';

const root = document.getElementById('app');
if (root) render(<Kiosk />, root);
