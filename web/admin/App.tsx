// The admin panel: password login, then results, question editor, signs, tablets and settings.
import { useEffect, useState } from 'preact/hooks';
import { ApiError } from '../lib/api.ts';
import { LOGGED_OUT, adminApi, useRoute } from './adminApi.ts';
import { defaultFilters, type Filters } from './pages/Filters.tsx';
import { Codes } from './pages/Codes.tsx';
import { Content } from './pages/Content.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Devices } from './pages/Devices.tsx';
import { SettingsPage } from './pages/Settings.tsx';
import { TopicResults } from './pages/TopicResults.tsx';

const NAV = [
  ['', 'Auswertung'],
  ['fragen', 'Fragen'],
  ['zeichen', 'Zeichen'],
  ['tablets', 'Tablets'],
  ['einstellungen', 'Einstellungen'],
] as const;

export function App() {
  const [auth, setAuth] = useState<'checking' | 'out' | 'in'>('checking');
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const route = useRoute();

  useEffect(() => {
    adminApi('/api/v1/admin/me').then(() => setAuth('in'), () => setAuth('out'));
    const out = () => setAuth('out');
    window.addEventListener(LOGGED_OUT, out);
    return () => window.removeEventListener(LOGGED_OUT, out);
  }, []);

  if (auth === 'checking') return <p class="page">Einen Moment …</p>;
  if (auth === 'out') return <Login onIn={() => setAuth('in')} />;

  const section = route[0] ?? '';
  const id = Number(route[1] ?? 0) || null;
  const current = section === 'thema' ? '' : section;

  async function logout(): Promise<void> {
    await adminApi('/api/v1/admin/logout', { method: 'POST' }).catch(() => undefined);
    setAuth('out');
  }

  return (
    <div class="admin">
      <header class="top">
        <a class="brand" href="#/">Wie isses? <span>Admin</span></a>
        <nav aria-label="Bereiche">
          {NAV.map(([path, label]) => (
            <a href={`#/${path}`} aria-current={current === path ? 'page' : undefined}>{label}</a>
          ))}
        </nav>
        <button type="button" class="ghost" onClick={() => void logout()}>Abmelden</button>
      </header>
      <main class="page">
        {section === '' && <Dashboard filters={filters} setFilters={setFilters} />}
        {section === 'thema' && id && <TopicResults topicId={id} filters={filters} setFilters={setFilters} />}
        {section === 'fragen' && <Content selectedId={id} />}
        {section === 'zeichen' && <Codes />}
        {section === 'tablets' && <Devices />}
        {section === 'einstellungen' && <SettingsPage />}
      </main>
    </div>
  );
}

function Login({ onIn }: { onIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi('/api/v1/admin/login', { json: { password } });
      onIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main class="login">
      <form class="card" onSubmit={(e) => void submit(e)}>
        <h1>Wie isses? · Admin</h1>
        <label for="pw">Passwort</label>
        <input id="pw" type="password" autocomplete="current-password" value={password} onInput={(e) => setPassword(e.currentTarget.value)} required />
        {error && <p class="error" role="alert">{error}</p>}
        <button type="submit" class="primary" disabled={busy}>Anmelden</button>
      </form>
    </main>
  );
}
