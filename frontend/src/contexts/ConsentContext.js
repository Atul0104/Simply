import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const ConsentContext = createContext(null);
const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = 'perfurm_consent_v1';
const ANON_KEY = 'perfurm_consent_subject';
const OPTIONAL_STORAGE = ['perfurm_visitor_id', 'recentlyViewed'];
const defaults = { necessary: true, functional: false, analytics: false, marketing: false, personalization: false };

function anonymousId() {
  let value = localStorage.getItem(ANON_KEY);
  if (!value) {
    value = (window.crypto?.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
    localStorage.setItem(ANON_KEY, value);
  }
  return value;
}

function clearOptionalStorage() {
  OPTIONAL_STORAGE.forEach(key => localStorage.removeItem(key));
  Object.keys(sessionStorage).filter(key => key.startsWith('perfurm_offer_popup_')).forEach(key => sessionStorage.removeItem(key));
  ['_ga', '_gid', '_gat', '_fbp'].forEach(name => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  });
}

export function ConsentProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/privacy/consent/config`).then(({ data }) => {
      setConfig(data);
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const current = saved && saved.expires_at > new Date().toISOString() &&
          saved.consent_policy_version === data.consent_policy_version &&
          saved.cookie_policy_version === data.cookie_policy_version &&
          saved.privacy_policy_version === data.privacy_policy_version;
        if (current) setPreferences({ ...defaults, ...saved.preferences, necessary: true });
      } catch (_) { localStorage.removeItem(STORAGE_KEY); }
    }).catch(() => setConfig(null));
  }, []);

  const save = useCallback(async (next, source = 'preference_center') => {
    if (!config) return false;
    const normalized = { ...defaults, ...next, necessary: true };
    if (navigator.globalPrivacyControl === true) {
      normalized.analytics = false; normalized.marketing = false; normalized.personalization = false;
    }
    const payload = {
      preferences: normalized, anonymous_id: anonymousId(), source,
      consent_policy_version: config.consent_policy_version,
      cookie_policy_version: config.cookie_policy_version,
      privacy_policy_version: config.privacy_policy_version,
    };
    const response = await axios.post(`${API_URL}/privacy/consent`, payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, expires_at: response.data.expires_at }));
    if (!normalized.functional || !normalized.analytics || !normalized.marketing || !normalized.personalization) clearOptionalStorage();
    setPreferences(normalized); setPreferencesOpen(false);
    window.dispatchEvent(new CustomEvent('perfurm:consent-changed', { detail: normalized }));
    return true;
  }, [config]);

  const value = useMemo(() => ({ config, preferences, hasConsent: category => category === 'necessary' || preferences?.[category] === true, save, acceptAll: () => save({ necessary: true, functional: true, analytics: true, marketing: true, personalization: true }, 'banner'), rejectAll: () => save(defaults, navigator.globalPrivacyControl === true ? 'gpc' : 'banner'), preferencesOpen, openPreferences: () => setPreferencesOpen(true), closePreferences: () => setPreferencesOpen(false) }), [config, preferences, save, preferencesOpen]);
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const value = useContext(ConsentContext);
  if (!value) throw new Error('useConsent must be used within ConsentProvider');
  return value;
}
