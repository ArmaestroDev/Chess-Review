// CI smoke test — verifies the deploy-frontend trigger fires on push.
import React from 'react';
import ReactDOM from 'react-dom/client';
// Init i18next before App so the first paint already renders the right strings.
import './i18n';
import App from './app/App';
import './index.css';
import './features/puzzles/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
