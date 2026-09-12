import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyDfWMciYKldNXbQH_BbaWlXBqPlGxGlXXw',
  authDomain: 'fieldops-260e1.firebaseapp.com',
  projectId: 'fieldops-260e1',
  appId: '1:86803465428:web:b4d838a4939baa8ebf6741',
});

export const auth = getAuth(firebaseApp);
