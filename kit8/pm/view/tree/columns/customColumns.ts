// Custom task columns of the tree (AddCustomProjectTaskColumn). Pure (no React / Skia).
//
//   project_table.rowJSON.customColumns = {
//     columns: [{ key: 'cc_k3v9x2qa', name: 'Budget', type: 'float', createdAt }],   // definitions, in creation order
//     headersBackgroundColors: { cc_k3v9x2qa: '#fde68a', name: '#e0f2fe' },            // header background per column key
//   }
//   project_task_table.rowJSON.customColumns = { cc_k3v9x2qa: 1250.5, cc_p0a1b2c3: true, ... }  // values per task
//
// Column order / widths are tree settings like the built-in columns:
//   project_table.rowJSON.uxuiSettings.treeColumnsOrder  (custom keys included - drag & drop)
//   project_table.rowJSON.uxuiSettings.treeColumnsWidths (resized columns)

export type PMCustomColumnType = 'text' | 'date' | 'boolean' | 'integer' | 'float';

/** Keys of custom columns always start with "cc_" (built-in keys never do). */
export type PMCustomColumnKey = `cc_${string}`;

export const PM_CUSTOM_COLUMN_TYPES: readonly PMCustomColumnType[] = ['text', 'date', 'boolean', 'integer', 'float'];

export const PM_CUSTOM_COLUMN_TYPE_LABEL: Record<PMCustomColumnType, string> = {
  text: 'Text',
  date: 'Date',
  boolean: 'Boolean',
  integer: 'Integer',
  float: 'Float',
};

/** Material symbols used in the header menu. */
export const PM_CUSTOM_COLUMN_TYPE_ICON: Record<PMCustomColumnType, string> = {
  text: 'text_fields',
  date: 'calendar_today',
  boolean: 'check_box',
  integer: 'pin',
  float: 'decimal_increase',
};

/** Default width of a new custom column (px). */
export const PM_CUSTOM_COLUMN_DEFAULT_WIDTH: Record<PMCustomColumnType, number> = {
  text: 120,
  date: 92,
  boolean: 70,
  integer: 80,
  float: 90,
};

export const PM_CUSTOM_COLUMN_NAME_MAX = 40;

export interface PMCustomColumnDef {
  key: PMCustomColumnKey;
  name: string;
  type: PMCustomColumnType;
  createdAt?: string;
}

/** project_table.rowJSON.customColumns */
export interface PMProjectCustomColumns {
  columns: PMCustomColumnDef[];
  /** Header background color per column key (custom or built-in); missing = theme header color. */
  headersBackgroundColors?: Record<string, string>;
}

/** Value of one custom cell. Dates are 'YYYY-MM-DD'. */
export type PMCustomColumnValue = string | number | boolean | null;

/** project_task_table.rowJSON.customColumns */
export type PMTaskCustomColumnValues = Record<string, PMCustomColumnValue>;

export function isCustomColumnKey(k: unknown): k is PMCustomColumnKey {
  return typeof k === 'string' && /^cc_[A-Za-z0-9_]+$/.test(k);
}

const isType = (t: unknown): t is PMCustomColumnType => typeof t === 'string' && (PM_CUSTOM_COLUMN_TYPES as readonly string[]).includes(t);

/** Validated project definitions (unknown / broken entries dropped). Also reads the misspelled "headersBacgroundColors". */
export function projectCustomColumnsOf(json: { customColumns?: unknown } | null | undefined): Required<PMProjectCustomColumns> {
  const raw = (json?.customColumns ?? {}) as Record<string, unknown>;
  const columns: PMCustomColumnDef[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.columns)) {
    for (const c of raw.columns as any[]) {
      if (!c || !isCustomColumnKey(c.key) || seen.has(c.key) || !isType(c.type)) continue;
      seen.add(c.key);
      columns.push({ key: c.key, name: typeof c.name === 'string' && c.name.trim() ? c.name : c.key, type: c.type, ...(c.createdAt ? { createdAt: String(c.createdAt) } : {}) });
    }
  }
  const colorsRaw = (raw.headersBackgroundColors ?? raw.headersBacgroundColors ?? {}) as Record<string, unknown>;
  const headersBackgroundColors: Record<string, string> = {};
  if (colorsRaw && typeof colorsRaw === 'object') {
    for (const [k, v] of Object.entries(colorsRaw)) if (typeof v === 'string' && v) headersBackgroundColors[k] = v;
  }
  return { columns, headersBackgroundColors };
}

/** Values of one task (always an object). */
export function taskCustomValuesOf(json: { customColumns?: unknown } | null | undefined): PMTaskCustomColumnValues {
  const v = json?.customColumns;
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as PMTaskCustomColumnValues) : {};
}

/** New unique key (not in `existing`). */
export function newCustomColumnKey(existing: readonly string[] = [], random: () => number = Math.random): PMCustomColumnKey {
  for (;;) {
    let s = '';
    while (s.length < 8) s += Math.floor(random() * 36).toString(36);
    const key = `cc_${s.slice(0, 8)}` as PMCustomColumnKey;
    if (!existing.includes(key)) return key;
  }
}

/** null = valid; otherwise the problem (shown in the name window). */
export function validateCustomColumnName(name: string, existing: readonly { name: string }[]): string | null {
  const n = name.trim();
  if (!n) return 'Enter a column name';
  if (n.length > PM_CUSTOM_COLUMN_NAME_MAX) return `At most ${PM_CUSTOM_COLUMN_NAME_MAX} characters`;
  const lower = n.toLowerCase();
  if (['#', 'task name', 'start', 'days', '%'].includes(lower)) return 'This is the name of a built-in column';
  if (existing.some((c) => c.name.trim().toLowerCase() === lower)) return 'A column with this name already exists';
  return null;
}

const DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/**
 * Parses what the user typed into a custom cell.
 * Empty text = null (cleared). Returns { value } or { error }.
 */
export function parseCustomColumnValue(type: PMCustomColumnType, text: string): { value: PMCustomColumnValue } | { error: string } {
  const t = text.trim();
  if (!t) return { value: null };
  switch (type) {
    case 'text':
      return { value: text.slice(0, 1000) };
    case 'boolean': {
      const l = t.toLowerCase();
      if (['true', 'yes', 'y', '1', '+', 'x', '✓'].includes(l)) return { value: true };
      if (['false', 'no', 'n', '0', '-'].includes(l)) return { value: false };
      return { error: 'yes / no' };
    }
    case 'integer': {
      if (!/^[-+]?\d+$/.test(t)) return { error: 'whole number' };
      const n = Number(t);
      return Number.isSafeInteger(n) ? { value: n } : { error: 'number too large' };
    }
    case 'float': {
      const s = t.replace(/\s/g, '').replace(',', '.');
      if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return { error: 'number' };
      const n = Number(s);
      return Number.isFinite(n) ? { value: n } : { error: 'number' };
    }
    case 'date': {
      const m = DATE_RE.exec(t);
      if (!m) return { error: 'YYYY-MM-DD' };
      const y = +m[1];
      const mo = +m[2];
      const d = +m[3];
      const ms = Date.UTC(y, mo - 1, d);
      const back = new Date(ms);
      if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return { error: 'no such date' };
      return { value: `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }
  }
}

/** Text shown in the tree cell (booleans are drawn as a check box: '' here). */
export function formatCustomColumnValue(type: PMCustomColumnType, v: PMCustomColumnValue | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  switch (type) {
    case 'boolean':
      return '';
    case 'integer':
      return typeof v === 'number' ? String(Math.trunc(v)) : String(v);
    case 'float':
      return typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v);
    default:
      return String(v);
  }
}

/** Text put into the inline editor. */
export function editTextOfCustomValue(type: PMCustomColumnType, v: PMCustomColumnValue | undefined): string {
  if (v === null || v === undefined) return '';
  if (type === 'boolean') return v ? 'yes' : 'no';
  return formatCustomColumnValue(type, v);
}

/** Numbers are right-aligned in the cell, everything else left-aligned. */
export function customColumnAlign(type: PMCustomColumnType): 'left' | 'right' | 'center' {
  return type === 'integer' || type === 'float' ? 'right' : type === 'boolean' ? 'center' : 'left';
}

// ---- project rowJSON edits (pure: return the new customColumns object) ----------------------

export function withCustomColumnAdded(json: { customColumns?: unknown } | null | undefined, def: PMCustomColumnDef): PMProjectCustomColumns {
  const cur = projectCustomColumnsOf(json);
  return { ...cur, columns: [...cur.columns.filter((c) => c.key !== def.key), def] };
}

export function withCustomColumnDeleted(json: { customColumns?: unknown } | null | undefined, key: string): PMProjectCustomColumns {
  const cur = projectCustomColumnsOf(json);
  const { [key]: _drop, ...headersBackgroundColors } = cur.headersBackgroundColors;
  return { columns: cur.columns.filter((c) => c.key !== key), headersBackgroundColors };
}

export function withHeaderBackgroundColor(json: { customColumns?: unknown } | null | undefined, key: string, color: string | null): PMProjectCustomColumns {
  const cur = projectCustomColumnsOf(json);
  const colors = { ...cur.headersBackgroundColors };
  if (color) colors[key] = color;
  else delete colors[key];
  return { ...cur, headersBackgroundColors: colors };
}

/** Header background swatches offered in the header menu. */
export const PM_HEADER_BACKGROUND_SWATCHES: readonly { color: string; label: string }[] = [
  { color: '#fef3c7', label: 'Yellow' },
  { color: '#dcfce7', label: 'Green' },
  { color: '#dbeafe', label: 'Blue' },
  { color: '#ede9fe', label: 'Violet' },
  { color: '#fce7f3', label: 'Pink' },
  { color: '#fee2e2', label: 'Red' },
  { color: '#e5e7eb', label: 'Grey' },
];
