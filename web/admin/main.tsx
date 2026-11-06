import { render } from 'preact';
import './admin.css';
import { App } from './App.tsx';

const root = document.getElementById('admin');
if (root) render(<App />, root);
