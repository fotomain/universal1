// The e-mail of the user made from an ID card / passport: <first given name>.<surname>@<domain of the signed-in user's e-mail>. Pure: no React, no native module.
//   JURIJS TERENTJEVS, signed in as boss@company.com  ->  jurijs.terentjevs@company.com
// Lower case, letters and digits only (marks of letters are dropped: Š -> s); a surname of several words is joined with '-' (VAN DER BERG -> van-der-berg).
// null = no e-mail can be made (no name, or the signed-in user has no e-mail with a domain: a guest).

const ascii = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (v: string) => ascii(v).replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** the domain of an e-mail ('boss@company.com' -> 'company.com'); '' when there is none */
export function emailDomainOf(email: unknown): string {
  const m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(String(email ?? '').trim().toLowerCase());
  return m ? m[1] : '';
}

export function userEmailFromIdDocument(givenNames: string, surname: string, activeUserEmail: unknown): string | null {
  const first = words(givenNames)[0];
  const last = words(surname).join('-');
  const domain = emailDomainOf(activeUserEmail);
  if (!first || !last || !domain) return null;
  return `${first}.${last}@${domain}`;
}
