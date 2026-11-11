// The words of a permission refusal in the language of the app (pmT). Apart from permissionModel.ts so that the pure rules (and usePermissions) do not pull the translation layer in.
import { pmT } from '../pm/i18n/pmT';
import { permissionRefusalOf } from './permissionModel';

const LETTER_TEXT: Record<string, string> = { C: 'create', R: 'read', U: 'change', D: 'delete' };

/** the refusal in words of the app language ('' = not a refusal) */
export function permissionRefusalText(error: any): string {
  const r = permissionRefusalOf(error);
  if (!r) return '';
  const op = pmT(LETTER_TEXT[r.letter as string] ?? 'change');
  const base = pmT('You have no permission to {{op}} in {{table}}.', { op, table: r.table });
  return r.field ? `${base} ${pmT('Locked: {{n}}', { n: r.field })}` : base;
}

/** a database refusal ("No permission: table, letter") is shown with its words; the original text stays as the hint. Any other error stays as it is. */
export function withPermissionText<T extends { message?: string | null; code?: any }>(payload: T): T {
  const text = permissionRefusalText(payload);
  return text ? { ...payload, message: text, hint: payload.message } : payload;
}
