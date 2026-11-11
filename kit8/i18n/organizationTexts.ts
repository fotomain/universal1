// The texts an administrator replaced for the whole organization (documentation/PERMISSIONS_WBS.html section 10; SQL PART 48: organizationTextTable, organization_texts(language)).
//   kind 'menu'    key = the i18next key ("menu.home")               -> t() through the postProcessor of kit8/i18n/i18n.ts
//   kind 'title'   key = the English text of pmT ("Organization members") -> pmT (kit8/pm/i18n/pmT.ts): screen, window and section titles, labels
//   kind 'column'  key = "<table>.<column key>"                        -> the header of a column of ReusableTable
// A missing row = the delivered text. The list is loaded once after the sign in (OrganizationTextsHost); a screen that is already open shows the new text after a reload.
export type OrganizationTextKind = 'menu' | 'column' | 'title';
export interface OrganizationTextRow {
  kind: OrganizationTextKind;
  key: string;
  text: string;
}

const byKind = new Map<string, string>();
const byKey = new Map<string, string>();
let version = 0;
const listeners = new Set<() => void>();

export function setOrganizationTexts(rows: readonly Partial<OrganizationTextRow>[] | null | undefined): void {
  byKind.clear();
  byKey.clear();
  for (const r of rows || []) {
    if (!r || !r.key || !r.text || (r.kind !== 'menu' && r.kind !== 'column' && r.kind !== 'title')) continue;
    byKind.set(`${r.kind}|${r.key}`, r.text);
    if (r.kind !== 'column') byKey.set(r.key, r.text);
  }
  version += 1;
  listeners.forEach((l) => l());
}

/** the replaced text of a kind and key (undefined = the delivered text) */
export const organizationText = (kind: OrganizationTextKind, key: string): string | undefined => (byKind.size ? byKind.get(`${kind}|${key}`) : undefined);

/** the replaced menu / title text of an English text or an i18n key (pmT and t() do not know the kind) */
export const organizationTextOfKey = (key: string): string | undefined => (byKey.size ? byKey.get(key) : undefined);

/** the title of a column of a table: the organization's header, else the delivered one */
export const columnTitleOf = (table: string | undefined, columnKey: string, delivered: string): string => (table ? organizationText('column', `${table}.${columnKey}`) ?? delivered : delivered);

export const organizationTextsVersion = () => version;
export const subscribeOrganizationTexts = (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const organizationTextCount = () => byKind.size;

/** i18next postProcessor ("orgTexts"): the replaced menu text wins over the delivered one */
export const orgTextsPostProcessor = {
  type: 'postProcessor' as const,
  name: 'orgTexts',
  process(value: string, key: string | string[]): string {
    const k = Array.isArray(key) ? key[0] : key;
    return (k && organizationText('menu', String(k).replace(/^[^:]+:/, ''))) || value;
  },
};
