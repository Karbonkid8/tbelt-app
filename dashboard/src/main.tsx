import { onAuthStateChanged, type User } from 'firebase/auth';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { App, Login } from './App';
import { auth } from './firebase';
import './styles.css';

function Root() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <p className="empty">Checking your session…</p>;
  return user ? <App user={user} /> : <Login />;
}

createRoot(document.querySelector('#root')!).render(<Root />);
