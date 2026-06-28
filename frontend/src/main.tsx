import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installChunkLoadRecovery } from './lib/lazyRetry';
import './index.css';
import App from './App.tsx';

installChunkLoadRecovery();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
