import { useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import './ThemeWaveOverlay.css';

export default function ThemeWaveOverlay() {
  const { waveTrigger } = useContext(ThemeContext);
  if (!waveTrigger) return null;
  return (
    <div
      className={`theme-wave theme-wave--${waveTrigger}`}
      aria-hidden="true"
    />
  );
}
