// The /settings screen: tabs + the search over the settings (documentation/USER_SETTINGS_TABLE_WBS.html). PURE: the list of the sections, the tabs and the search.

export type SettingsTabId = 'general' | 'fonts' | 'colors' | 'dashboards' | 'media' | 'device';

export interface SettingsTab { id: SettingsTabId; title: string }
export const SETTINGS_TABS: SettingsTab[] = [
  { id: 'general', title: 'General' },
  { id: 'fonts', title: 'Fonts' },
  { id: 'colors', title: 'Colors' },
  { id: 'dashboards', title: 'Dashboards' },
  { id: 'media', title: 'Media' },
  { id: 'device', title: 'This device' },
];

export interface SettingsSectionDef {
  id: string;
  tab: SettingsTabId;
  title: string;
  /** words the search also finds (lower case) */
  keywords: string[];
}

/** every block of the screen, in the order it is shown; the search looks at the title, the keywords and the tab name */
export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { id: 'design-system', tab: 'general', title: 'Design system', keywords: ['look', 'paper', 'material', 'expo ui', 'apple', 'ios', 'native', 'tamagui', 'ant', 'theme'] },
  { id: 'dark-mode', tab: 'general', title: 'Dark mode', keywords: ['dark', 'light', 'night', 'theme'] },
  { id: 'icons', tab: 'general', title: 'Icon styles', keywords: ['icons', 'material icons', 'platform'] },
  { id: 'behaviour', tab: 'general', title: 'Buttons and questions', keywords: ['fab', 'animation', 'bottom tabs', 'ask before delete', 'confirm', 'floating button'] },
  { id: 'font-theme', tab: 'fonts', title: 'Font of the interface', keywords: ['font', 'typeface', 'system', 'roboto', 'inter', 'selawik', 'size', 'small', 'medium', 'large', 'text'] },
  { id: 'font-elements', tab: 'fonts', title: 'Font of each element', keywords: ['input', 'label', 'button', 'title', 'font', 'element', 'size'] },
  { id: 'colors', tab: 'colors', title: 'Theme colors', keywords: ['color', 'colour', 'primary', 'secondary', 'tertiary', 'background', 'surface', 'error', 'palette', 'reset'] },
  { id: 'fab-color', tab: 'colors', title: 'Floating button color', keywords: ['fab', 'color', 'floating action button'] },
  { id: 'dash-estimation', tab: 'dashboards', title: 'Estimation dashboard', keywords: ['estimation', 'estimate', 'grid', 'header', 'cell', 'background', 'font', 'norm'] },
  { id: 'dash-project', tab: 'dashboards', title: 'Project dashboard', keywords: ['project', 'tree', 'tasks', 'table', 'header', 'cell', 'background', 'font', 'gantt'] },
  { id: 'media-play', tab: 'media', title: 'Video player', keywords: ['video', 'play', 'rewind', 'forward', 'hide buttons', 'seconds'] },
  { id: 'media-record', tab: 'media', title: 'Video recorder', keywords: ['video', 'record', 'camera', 'date', 'time', 'stamp', 'torch', 'flashlight'] },
  { id: 'device-info', tab: 'device', title: 'This device', keywords: ['device', 'desktop', 'phone', 'tablet', 'os', 'macos', 'windows', 'android', 'ios', 'copy', 'other device', 'reset', 'defaults', 'sync'] },
];

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Does the section match the search text? Every word of the text must appear (start of a word) in the title, a keyword or the tab name. */
export function sectionMatches(section: SettingsSectionDef, query: string): boolean {
  const words = norm(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const tabTitle = SETTINGS_TABS.find((t) => t.id === section.tab)?.title ?? '';
  const hay = norm([section.title, tabTitle, ...section.keywords].join(' ')).split(' ');
  return words.every((w) => hay.some((h) => h.startsWith(w)));
}

export function filterSections(query: string, sections: SettingsSectionDef[] = SETTINGS_SECTIONS): SettingsSectionDef[] {
  return sections.filter((s) => sectionMatches(s, query));
}

/** the sections of one tab */
export function sectionsOfTab(tab: SettingsTabId, sections: SettingsSectionDef[] = SETTINGS_SECTIONS): SettingsSectionDef[] {
  return sections.filter((s) => s.tab === tab);
}

/** the tabs that still have a hit for the search (the tab bar shows a count) */
export function hitsPerTab(query: string): Record<SettingsTabId, number> {
  const out: Record<string, number> = {};
  for (const t of SETTINGS_TABS) out[t.id] = 0;
  for (const s of filterSections(query)) out[s.tab] += 1;
  return out as Record<SettingsTabId, number>;
}

/** the MD3 colors the Colors tab lets the user change (the main ones first) */
export const THEME_COLOR_KEYS: { key: string; title: string }[] = [
  { key: 'primary', title: 'Primary' },
  { key: 'onPrimary', title: 'On primary' },
  { key: 'primaryContainer', title: 'Primary container' },
  { key: 'secondary', title: 'Secondary' },
  { key: 'tertiary', title: 'Tertiary' },
  { key: 'background', title: 'Background' },
  { key: 'surface', title: 'Surface' },
  { key: 'surfaceVariant', title: 'Surface variant' },
  { key: 'outline', title: 'Outline' },
  { key: 'error', title: 'Error' },
];
