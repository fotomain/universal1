// costFormat - number formats of the cost calculator (pure). English number format on every device, like the spec's sketch.

export function formatUsd(x: number): string {
  if (!Number.isFinite(x)) return '-';
  return '$' + (x >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(2));
}

export function formatNumber(x: number, decimals = 0): string {
  if (!Number.isFinite(x)) return '-';
  return x.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/** KB -> '12.4 MB' / '3.20 GB' */
export function formatKB(kb: number): string {
  if (!Number.isFinite(kb)) return '-';
  if (kb >= 1048576) return formatNumber(kb / 1048576, 2) + ' GB';
  if (kb >= 1024) return formatNumber(kb / 1024, 1) + ' MB';
  return formatNumber(kb, 0) + ' KB';
}

export function formatPercent(share: number): string {
  if (!Number.isFinite(share)) return '-';
  return formatNumber(share * 100) + ' %';
}
