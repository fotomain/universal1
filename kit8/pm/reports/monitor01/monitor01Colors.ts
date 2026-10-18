// monitor01Colors - the background colour of the CRITICAL cells (the Google Doc: "Background color of the critical cells needed"). The sheet has no coloured cells, so the rules below are
// the proposal of documentation/MONITOR01_WBS.html (section 2, Q1): they live in ONE place; change them here.
//
//   rest to contract  > 0  warn  (still to contract)      < 0  bad (contracted more than planned)      = 0 with a plan  good (fully contracted)
//   on-hand           < 0  bad  (used more than received) = 0 with something used  warn (everything received is used up)
//   planned           the row has stale plan rows ("Post needed") → warn
import type { Monitor01Measure, Monitor01Row } from './monitor01Model';

export type Monitor01Tone = 'none' | 'good' | 'warn' | 'bad';

/** the tone of one number cell of a row (or of a subtotal: pass the sums as a row-like object) */
export function cellTone(measure: Monitor01Measure, v: Pick<Monitor01Row, 'qtyPlanned' | 'qtyContracted' | 'qtyRestToContract' | 'qtyReceived' | 'qtyVendorInvoiced' | 'qtyOrdered' | 'qtyUsed' | 'qtyOnHand'> & { hasStalePlan?: boolean }): Monitor01Tone {
  switch (measure) {
    case 'restToContract':
      if (v.qtyRestToContract > 0) return 'warn';
      if (v.qtyRestToContract < 0) return 'bad';
      return v.qtyPlanned > 0 ? 'good' : 'none';
    case 'onHand':
      if (v.qtyOnHand < 0) return 'bad';
      return v.qtyOnHand === 0 && v.qtyUsed > 0 ? 'warn' : 'none';
    case 'planned':
      return v.hasStalePlan ? 'warn' : 'none';
    default:
      return 'none';
  }
}

/** the background of a tone (light / dark) */
export function toneBackground(tone: Monitor01Tone, isDark: boolean): string | undefined {
  switch (tone) {
    case 'good': return isDark ? '#14532d' : '#bbf7d0';
    case 'warn': return isDark ? '#78350f' : '#fde68a';
    case 'bad': return isDark ? '#7f1d1d' : '#fecaca';
    default: return undefined;
  }
}
