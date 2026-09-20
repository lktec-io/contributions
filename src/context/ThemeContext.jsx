import { createContext, useState, useEffect, useRef } from 'react';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme,       setTheme]       = useState(() => localStorage.getItem('theme') || 'light');
  const [waveTrigger, setWaveTrigger] = useState(null); // null | 'light' | 'dark'
  const timers = useRef([]);

  useEffect(() => {
    /* White is the base palette, so only dark stamps an attribute. */
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
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
