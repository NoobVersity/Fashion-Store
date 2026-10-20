import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import api from '../services/api.js';
import { formatMoney } from '../utils/format.js';

const DEFAULTS = {
  store_name: 'THREADS',
  contact_email: 'hello@threads.store',
  contact_phone: '',
  currency: 'USD',
  currency_symbol: '$',
  store_description: '',
  low_stock_threshold: '5',
};

const SettingsContext = createContext(null);

/**
 * Loads public store settings once (store name, contact details,
 * currency) and exposes a money formatter that always uses the
 * configured currency symbol.
 */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    let alive = true;
    api
      .get('/store-settings/public')
      .then((data) => {
        if (alive && data) setSettings({ ...DEFAULTS, ...data });
      })
      .catch(() => {
        /* keep defaults — storefront must still render offline */
      });
    return () => {
      alive = false;
    };
  }, []);

  const money = useCallback(
    (cents) => formatMoney(cents, settings.currency_symbol || '$'),
    [settings.currency_symbol]
  );

  return (
    <SettingsContext.Provider value={{ settings, money }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
