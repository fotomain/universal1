// F6 WBS code mask (pure): the outline number "1.2.3" written by a mask per level, for example "A.01.001" -> "B.02.003".
//   one part per level, separated by dots; a part is: 1 = the number · 01 / 001 = the number with leading zeros · A = an upper-case letter (1 = A) · a = a lower-case letter ·
//   any other text is written as it is, with the number at its `#` (for example "T#" -> T4); a level that has no part uses 1 (the plain number).
export function formatWbsMask(wbs: string, mask: string): string {
  if (!wbs || !mask.trim()) return wbs;
  const parts = mask.split('.');
  const nums = wbs.split('.');
  return nums
    .map((n, i) => {
      const num = Number(n);
      const m = (parts[i] ?? '1').trim();
      if (!Number.isFinite(num)) return n;
      if (m === 'A' || m === 'a') {
        let k = num;
        let s = '';
        while (k > 0) { s = String.fromCharCode(((k - 1) % 26) + (m === 'A' ? 65 : 97)) + s; k = Math.floor((k - 1) / 26); }
        return s || n;
      }
      if (/^0+1$/.test(m)) return String(num).padStart(m.length, '0');
      if (m.includes('#')) return m.replace('#', String(num));
      return String(num);
    })
    .join('.');
}
