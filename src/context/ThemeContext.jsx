import { createContext, useState, useEffect, useRef } from 'react';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  /* Key deliberately bumped from 'theme' to 'ct_theme': the previous provider
     wrote 'dark' automatically on every mount, so returning users all carried a
     stale preference they never chose. The new key starts everyone on the light
     workspace, and the toggle still persists their real choice from here on. */
  const [theme,       setTheme]       = useState(() => localStorage.getItem('ct_theme') || 'light');
  const [waveTrigger, setWaveTrigger] = useState(null); // null | 'light' | 'dark'
  const timers = useRef([]);

  useEffect(() => {
    /* White is the base palette, so only dark stamps an attribute. */
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('ct_theme', theme);
  }, [theme]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const toggleTheme = () => {
    if (waveTrigger) return; // ignore rapid clicks during animation
    const next = theme === 'dark' ? 'light' : 'dark';
    setWaveTrigger(next);

    // Apply theme when wave fully covers the screen (~42% through 880ms)
    timers.current.push(setTimeout(() => setTheme(next), 370));

    // Remove wave after full animation
    timers.current.push(setTimeout(() => setWaveTrigger(null), 900));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, waveTrigger }}>
      {children}
    </ThemeContext.Provider>
  );
}
