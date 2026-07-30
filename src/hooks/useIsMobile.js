import { useState, useEffect } from 'react';

// 768px matches the breakpoint already used across this app's CSS
// (Sidebar, Header, dashboards, Login, etc.) — this hook just makes that
// same "mobile" definition readable from JS.
const QUERY = '(max-width: 768px)';

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};
