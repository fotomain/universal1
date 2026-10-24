// reportFormat - the number helpers every money report shares (Monitor07 first; Monitor01-03 can adopt them later).
//   formatReportMoney   1234.5 -> "1 234.50" (thin groups of three, always two decimals, a minus sign for a negative number)
//   parseReportAmount   the text of an amount filter: '' -> null (no filter), '-12,5' -> -12.5, 'abc' -> 'invalid'. A comma is a decimal point; spaces are ignored
export const formatReportMoney = (n: number): string => {
  const v = Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${d}`;
};

export const parseReportAmount = (text: string | null | undefined): number | null | 'invalid' => {
  const t = (text ?? '').replace(/\s+/g, '').replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return 'invalid';
  return Number(t);
};
