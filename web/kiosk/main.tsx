import { render } from 'preact';
import '@fontsource/andika/latin-400.css';
import '@fontsource/andika/latin-700.css';
import './kiosk.css';
import { Kiosk } from './Kiosk.tsx';

const root = document.getElementById('app');
if (root) render(<Kiosk />, root);
