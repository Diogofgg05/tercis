import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Apply saved density before first paint to prevent layout jumping.
document.documentElement.classList.toggle('tercis-compact',localStorage.getItem('tercis:compact-ui') !== 'false');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
