import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ compact = false }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className={compact
        ? 'h-8 w-8 rounded-lg border border-border-subtle bg-bg-elevated/70 text-text-secondary flex items-center justify-center hover:text-text-primary hover:border-border-accent transition-colors'
        : 'w-full h-10 rounded-xl border border-border-subtle bg-bg-elevated/70 text-text-secondary flex items-center justify-center gap-2 hover:text-text-primary hover:border-border-accent transition-colors'}
    >
      {isDark ? <Moon size={compact ? 15 : 16} /> : <Sun size={compact ? 15 : 16} />}
      {!compact && <span className="text-xs font-medium">{isDark ? 'Dark theme' : 'Light theme'}</span>}
    </button>
  );
}
