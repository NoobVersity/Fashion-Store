import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <ToastProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
