export const THEME_OPTIONS = [
  { key: 'dark', label: 'Dark' },
  { key: 'warm', label: 'Warm' },
  { key: 'earth', label: 'Earth' },
  { key: 'water', label: 'Water' },
] as const;

export type ThemeKey = (typeof THEME_OPTIONS)[number]['key'];

export function getThemeLabel(theme: string): string {
  const option = THEME_OPTIONS.find(opt => opt.key === theme);
  return option ? option.label : 'Theme';
}

export function renderThemePicker(theme: string | null | undefined): string {
  const label = getThemeLabel(theme || '');
  return `
    <div class="theme-picker">
      <button id="themeBtn" class="theme-btn" type="button">Theme${label !== 'Theme' ? `: ${label}` : ''}</button>
      <div id="themeMenu" class="theme-menu hidden">
        ${THEME_OPTIONS.map(opt => `<button type="button" class="theme-option-btn" data-theme="${opt.key}">${opt.label}</button>`).join('')}
      </div>
    </div>
  `;
}

export function applyTheme(theme: ThemeKey) {
  const selected = THEME_OPTIONS.find(opt => opt.key === theme);
  if (!selected) return;
  document.body.dataset.theme = selected.key;
  localStorage.setItem('gamehub_theme', selected.key);
}

export function loadTheme(): ThemeKey | null {
  const stored = localStorage.getItem('gamehub_theme');
  if (!stored) return null;
  const selected = THEME_OPTIONS.find(opt => opt.key === stored);
  return selected ? selected.key : null;
}
