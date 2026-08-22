// Color themes for the carousel. The LAYOUT never changes, only the palette,
// so every post still reads as EPG (same type, same grid, same mark) while the
// feed stays visually varied. The agent rotates least-recently-used (src/state.js).
//
// Each theme supplies:
//   bg         page background
//   accent     primary highlight + CTA button + number
//   accentSoft secondary highlight (headings, eyebrow); on light themes this is
//              usually a DARKER shade so it stays readable
//   accentRgb  "r,g,b" of accent, used for translucent panels and the glow
//   text       main text
//   muted      body copy
//   onAccent   text sitting on top of the accent color
//   isDark     drives the hairline/panel alpha and glow strength

export const THEMES = [
  {
    id: 'midnight',
    name: 'Midnight (core brand)',
    isDark: true,
    bg: '#000000',
    accent: '#4f63f5',
    accentSoft: '#7d8bff',
    accentRgb: '79,99,245',
    text: '#ffffff',
    muted: '#c9cdd6',
    onAccent: '#ffffff',
  },
  {
    id: 'paper',
    name: 'Paper (light)',
    isDark: false,
    bg: '#f4f3ef',
    accent: '#3b4ee0',
    accentSoft: '#2a3ab5',
    accentRgb: '59,78,224',
    text: '#14140f',
    muted: '#4d4d47',
    onAccent: '#ffffff',
  },
  {
    id: 'forest',
    name: 'Deep green',
    isDark: true,
    bg: '#05201a',
    accent: '#2fd39b',
    accentSoft: '#68e3b9',
    accentRgb: '47,211,155',
    text: '#ffffff',
    muted: '#bdd6ce',
    onAccent: '#04231c',
  },
  {
    id: 'clay',
    name: 'Warm clay (light)',
    isDark: false,
    bg: '#f7f2e9',
    accent: '#c2410c',
    accentSoft: '#9a3412',
    accentRgb: '194,65,12',
    text: '#1c1917',
    muted: '#57534e',
    onAccent: '#ffffff',
  },
  {
    id: 'violet',
    name: 'Electric violet',
    isDark: true,
    bg: '#120a20',
    accent: '#a855f7',
    accentSoft: '#c99bff',
    accentRgb: '168,85,247',
    text: '#ffffff',
    muted: '#cfc6dd',
    onAccent: '#ffffff',
  },
  {
    id: 'signal',
    name: 'Signal red (warnings)',
    isDark: true,
    bg: '#170608',
    accent: '#ef4444',
    accentSoft: '#ff8080',
    accentRgb: '239,68,68',
    text: '#ffffff',
    muted: '#dcc6c6',
    onAccent: '#ffffff',
  },
  {
    id: 'ocean',
    name: 'Ocean teal',
    isDark: true,
    bg: '#04202b',
    accent: '#22d3ee',
    accentSoft: '#7ae4f5',
    accentRgb: '34,211,238',
    text: '#ffffff',
    muted: '#bcd6dd',
    onAccent: '#05222c',
  },
  {
    id: 'slate',
    name: 'Cool slate (light)',
    isDark: false,
    bg: '#e7eaee',
    accent: '#2563eb',
    accentSoft: '#1d4ed8',
    accentRgb: '37,99,235',
    text: '#0f172a',
    muted: '#475569',
    onAccent: '#ffffff',
  },
];

export const DEFAULT_THEME = THEMES[0];

export function themeById(id) {
  return THEMES.find((t) => t.id === id) || DEFAULT_THEME;
}

/** The :root custom properties for one theme. */
export function themeCss(theme = DEFAULT_THEME) {
  const t = theme;
  const line = t.isDark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.12)';
  const glow = t.isDark ? 0.28 : 0.16;
  const panel = t.isDark ? 0.12 : 0.1;
  const border = t.isDark ? 0.4 : 0.32;
  const chk = t.isDark ? 0.15 : 0.12;
  const lockBg = t.isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
  return `:root{
  --bg:${t.bg};
  --accent:${t.accent};
  --accent-soft:${t.accentSoft};
  --accent-rgb:${t.accentRgb};
  --text:${t.text};
  --muted:${t.muted};
  --on-accent:${t.onAccent};
  --line:${line};
  --glow:${glow};
  --panel:${panel};
  --border:${border};
  --chk:${chk};
  --lock-bg:${lockBg};
}`;
}
