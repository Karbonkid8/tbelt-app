import { onAuthStateChanged, type User } from 'firebase/auth';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { App, Login } from './App';
import { auth } from './firebase';
import { applyTheme, loadTheme, type Theme } from './theme';
import './styles.css';
import './views.css';

function Root() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => applyTheme(theme), [theme]);
  if (user === undefined) return <p className="empty">Checking your session…</p>;
  return user ? <App user={user} theme={theme} onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} /> : <Login theme={theme} onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} />;
}

createRoot(document.querySelector('#root')!).render(<Root />);
