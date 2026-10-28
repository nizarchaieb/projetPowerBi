import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/base.css';
import './index.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/responsive.css';

const storedTheme = localStorage.getItem('ventepilot-theme');
const themePreference = window.matchMedia('(prefers-color-scheme: light)');
const preferredTheme = themePreference.matches ? 'light' : 'dark';
document.documentElement.dataset.theme = storedTheme || preferredTheme;
themePreference.addEventListener?.('change', (event) => {
  if (localStorage.getItem('ventepilot-theme')) return;
  document.documentElement.dataset.theme = event.matches ? 'light' : 'dark';
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = event.matches ? '#f4f7f8' : '#101820';
  window.dispatchEvent(new CustomEvent('ventepilot:theme-change', { detail: event.matches ? 'light' : 'dark' }));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
