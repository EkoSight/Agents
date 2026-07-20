// Dynamic Theme Templates (App Appearance)
// A palette-swapping system: each theme overrides a small set of CSS custom
// properties on :root, so the whole UI re-skins instantly. The choice is
// persisted in localStorage and re-applied on launch.

const ThemeManager = (() => {
  const STORAGE_KEY = 'soil_doctor_theme';

  // Each theme is a set of CSS variable overrides layered on top of styles.css.
  const THEMES = [
    {
      id: 'soil-green', name: 'Soil Green', emoji: '🌱',
      vars: {
        '--bg-primary': '#090d16', '--bg-secondary': '#131924',
        '--accent-color': '#34c759', '--accent-blue': '#007aff',
        '--glow-1': 'rgba(52, 199, 89, 0.15)', '--glow-2': 'rgba(0, 122, 255, 0.10)',
        '--title-grad': 'linear-gradient(135deg, #ffffff 0%, #a5f3fc 100%)'
      }
    },
    {
      id: 'ocean-blue', name: 'Ocean Blue', emoji: '🌊',
      vars: {
        '--bg-primary': '#07121e', '--bg-secondary': '#0f2233',
        '--accent-color': '#0a84ff', '--accent-blue': '#32ade6',
        '--glow-1': 'rgba(10, 132, 255, 0.18)', '--glow-2': 'rgba(50, 173, 230, 0.12)',
        '--title-grad': 'linear-gradient(135deg, #ffffff 0%, #7dd3fc 100%)'
      }
    },
    {
      id: 'harvest', name: 'Harvest Sunset', emoji: '🌾',
      vars: {
        '--bg-primary': '#150d08', '--bg-secondary': '#241610',
        '--accent-color': '#ff9500', '--accent-blue': '#ff375f',
        '--glow-1': 'rgba(255, 149, 0, 0.18)', '--glow-2': 'rgba(255, 55, 95, 0.10)',
        '--title-grad': 'linear-gradient(135deg, #ffffff 0%, #ffd8a8 100%)'
      }
    },
    {
      id: 'terracotta', name: 'Terracotta Earth', emoji: '🪴',
      vars: {
        '--bg-primary': '#160f0c', '--bg-secondary': '#261813',
        '--accent-color': '#c1642d', '--accent-blue': '#8a9a5b',
        '--glow-1': 'rgba(193, 100, 45, 0.18)', '--glow-2': 'rgba(138, 154, 91, 0.12)',
        '--title-grad': 'linear-gradient(135deg, #ffffff 0%, #e7c9a9 100%)'
      }
    },
    {
      id: 'midnight', name: 'Midnight Purple', emoji: '🌌',
      vars: {
        '--bg-primary': '#0c0a16', '--bg-secondary': '#181428',
        '--accent-color': '#bf5af2', '--accent-blue': '#5e5ce6',
        '--glow-1': 'rgba(191, 90, 242, 0.18)', '--glow-2': 'rgba(94, 92, 230, 0.12)',
        '--title-grad': 'linear-gradient(135deg, #ffffff 0%, #d8b4fe 100%)'
      }
    },
    {
      id: 'daylight', name: 'Daylight', emoji: '☀️',
      light: true,
      vars: {
        '--bg-primary': '#eef2f7', '--bg-secondary': '#ffffff',
        '--card-bg': 'rgba(255, 255, 255, 0.75)', '--card-border': 'rgba(0, 0, 0, 0.08)',
        '--text-primary': '#0b1220', '--text-secondary': '#475569', '--text-muted': '#94a3b8',
        '--accent-color': '#16a34a', '--accent-blue': '#2563eb',
        '--glow-1': 'rgba(22, 163, 74, 0.12)', '--glow-2': 'rgba(37, 99, 235, 0.10)',
        '--title-grad': 'linear-gradient(135deg, #0b1220 0%, #16a34a 100%)'
      }
    }
  ];

  function getSaved() {
    return localStorage.getItem(STORAGE_KEY) || 'soil-green';
  }

  function apply(themeId) {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    const root = document.documentElement;

    // Reset previously-set inline overrides so themes don't leak into each other.
    const allKeys = new Set();
    THEMES.forEach(t => Object.keys(t.vars).forEach(k => allKeys.add(k)));
    allKeys.forEach(k => root.style.removeProperty(k));

    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-theme', theme.light ? 'light' : 'dark');

    localStorage.setItem(STORAGE_KEY, theme.id);

    // Keep the PWA status-bar / manifest theme colour roughly in sync.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.vars['--bg-secondary'] || '#131924');

    return theme;
  }

  function init() {
    return apply(getSaved());
  }

  return { THEMES, apply, init, getSaved };
})();
