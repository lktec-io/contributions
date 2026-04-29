import { createContext, useState, useEffect, useRef } from 'react';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme,       setTheme]       = useState(() => localStorage.getItem('theme') || 'dark');
  const [waveTrigger, setWaveTrigger] = useState(null); // null | 'light' | 'dark'
  const timers = useRef([]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
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
