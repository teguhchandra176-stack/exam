import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.info('BAGJA EXAM PWA: Versi baru telah tersedia di cache latar belakang.');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('BAGJA EXAM: Service Worker registration:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
