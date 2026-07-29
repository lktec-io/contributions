import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { settingsService } from '../services/settingsService';

export const BrandingContext = createContext(null);

const STORAGE_KEY = 'ct_branding';
const DEFAULT_BRANDING = { logoUrl: null, organizationName: 'Finance Hub' };

function loadCached() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BRANDING;
    const parsed = JSON.parse(raw);
    return {
      logoUrl: parsed.logoUrl || null,
      organizationName: parsed.organizationName || DEFAULT_BRANDING.organizationName,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

function saveCached(branding) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(branding));
  } catch {
    // private browsing / storage full — branding just won't survive a refresh
  }
}

// Deliberately separate from AuthContext: `user` there is rebuilt purely
// from the decoded JWT on every page load ({userId, role, email}+name),
// so any extra field bolted onto it would silently vanish on refresh.
// Branding instead hydrates synchronously from localStorage on mount (so a
// refresh never shows a flash of default branding) and then reconciles
// with the server via the existing GET /api/settings endpoint.
export function BrandingProvider({ children }) {
  const { user, authReady } = useContext(AuthContext);
  const [branding, setBrandingState] = useState(loadCached);

  const setBranding = useCallback((partial) => {
    setBrandingState(prev => {
      const next = { ...prev, ...partial };
      saveCached(next);
      return next;
    });
  }, []);

  const refreshBranding = useCallback(async () => {
    try {
      const res = await settingsService.get();
      const d = res.data.data;
      setBranding({
        logoUrl: d.branding_logo_url || null,
        organizationName: d.branding_org_name || DEFAULT_BRANDING.organizationName,
      });
    } catch {
      // silent — cached/default branding stays in effect
    }
  }, [setBranding]);

  useEffect(() => {
    if (!authReady) return; // still resolving auth — keep whatever was cached
    if (user) {
      refreshBranding();
    } else {
      setBrandingState(DEFAULT_BRANDING);
      saveCached(DEFAULT_BRANDING);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authReady]);

  return (
    <BrandingContext.Provider value={{ ...branding, setBranding, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
