// Application texts of an organization (pure; documentation/PERMISSIONS_WBS.html section 10; SQL PART 48): the rows of the screen and the writes an edit needs.
import type { OrganizationTextKind } from '../../../i18n/organizationTexts';

export const ORGANIZATION_TEXT_TABLE = 'organizationTextTable';
export const TEXT_KINDS: readonly OrganizationTextKind[] = ['menu', 'title', 'column'];

/** a row of organizationTextTable */
export interface TextRow {
  rowGUID: string;
  rowParentGUID: string;
  rowJSON: { textKind?: string; textKey?: string; text?: string };
}

/** a row of the screen: a delivered text and the organization's text (empty = the delivered one is used) */
export interface TextScreenRow {
  id: string;
  kind: OrganizationTextKind;
  key: string;
  delivered: string;
  text: string;
  /** the rowGUID of the organization's row (null = none) */
  rowGUID: string | null;
}

const idOf = (kind: string, key: string) => `${kind}|${key}`;

/** flatten the i18next bundle ({ menu: { home: 'Home' } }) to { 'menu.home': 'Home' } - the strings only */
export function flattenBundle(bundle: any, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (!bundle || typeof bundle !== 'object') return out;
  for (const [k, v] of Object.entries(bundle)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flattenBundle(v, key));
  }
  return out;
}

/**
 * The rows of the screen: every delivered title of pmT (kind title) and every menu / screen text of i18next (kind menu), plus the organization's rows of ANY key (a column header
 * "table.column" has no delivered list). The organization's text is filled from its rows.
 */
export function textScreenRows(pmKeys: readonly string[], bundle: Record<string, string>, own: readonly TextRow[]): TextScreenRow[] {
  const by = new Map<string, TextScreenRow>();
  for (const k of pmKeys) by.set(idOf('title', k), { id: idOf('title', k), kind: 'title', key: k, delivered: k, text: '', rowGUID: null });
  for (const [k, v] of Object.entries(bundle)) {
    if (!/^(menu|screens)\./.test(k)) continue;
    by.set(idOf('menu', k), { id: idOf('menu', k), kind: 'menu', key: k, delivered: v, text: '', rowGUID: null });
  }
  for (const r of own) {
    const kind = r.rowJSON?.textKind as OrganizationTextKind;
    const key = r.rowJSON?.textKey;
    if (!key || !TEXT_KINDS.includes(kind)) continue;
    const row = by.get(idOf(kind, key)) ?? { id: idOf(kind, key), kind, key, delivered: kind === 'column' ? key.split('.').slice(1).join('.') : key, text: '', rowGUID: null };
    row.text = String(r.rowJSON?.text ?? '');
    row.rowGUID = r.rowGUID;
    by.set(row.id, row);
  }
  return Array.from(by.values()).sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
}

export type TextWrite =
  | { kind: 'insert'; textKind: OrganizationTextKind; key: string; text: string }
  | { kind: 'update'; guid: string; text: string }
  | { kind: 'delete'; guid: string };

/** the writes an edit of the table needs: a filled cell becomes (or updates) a row; a cleared cell, or a text equal to the delivered one, removes it */
export function textWrites(before: readonly TextScreenRow[], after: ReadonlyArray<{ id: string; text: string }>): TextWrite[] {
  const prev = new Map(before.map((r) => [r.id, r]));
  const out: TextWrite[] = [];
  for (const a of after) {
    const b = prev.get(a.id);
    if (!b) continue;
    const next = String(a.text ?? '').trim();
    if (next === b.text) continue;
    if (!next || next === b.delivered) { if (b.rowGUID) out.push({ kind: 'delete', guid: b.rowGUID }); continue; }
    out.push(b.rowGUID ? { kind: 'update', guid: b.rowGUID, text: next } : { kind: 'insert', textKind: b.kind, key: b.key, text: next });
  }
  return out;
}

/** a row typed in the "Add" bar: a column header or any key that is not in the delivered list */
export function newTextRowOf(kind: string, key: string, text: string): { ok: true; row: Extract<TextWrite, { kind: 'insert' }> } | { ok: false; error: string } {
  const k = key.trim();
  const t = text.trim();
  if (!TEXT_KINDS.includes(kind as OrganizationTextKind)) return { ok: false, error: 'kind' };
  if (!k) return { ok: false, error: 'key' };
  if (kind === 'column' && !/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(k)) return { ok: false, error: 'columnKey' };
  if (!t) return { ok: false, error: 'text' };
  return { ok: true, row: { kind: 'insert', textKind: kind as OrganizationTextKind, key: k, text: t } };
}
