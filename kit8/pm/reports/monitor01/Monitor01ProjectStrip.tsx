// Monitor01ProjectStrip - the strip above the table of Monitor01 (documentation/ROI_DOC.html section 7.1): the money of the project(s) in the bar for the chosen period -
// Budget (cost plan) · Vendor Invoice Amount · Customer Invoice Amount - read from the MONTH TOTALS (one small query, a few rows per project), on the VAT basis of the screen.
// It is there before the big row query has finished, and it is the same money as the three money columns of the table. It reads again when the rows of the report change (refreshKey).
// Not shown while the month totals are empty, unreadable (an old database) or loading for the first time: the report works without it.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSupabase } from '../../../providers/WithSupabase';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { pmT } from '../../i18n/pmT';
import { parseDayInput } from '../../../documents/fact/input/factInputModel';
import { VAT_BASIS_SHORT, VatBasis } from '../../vat/vatBasis';
import { RoiMonthRow, fetchRoiMonthTotals } from '../roi/roiApi';
import { formatRoiMoney } from '../roi/roiModel';
import { roiStripIsEmpty, roiStripOf } from '../roi/roiStripModel';

export interface Monitor01ProjectStripProps {
  /** the project of the bar (project mode, or the Project filter); null = every project of mine */
  projectGUID: string | null;
  startDate: string;
  finishDate: string;
  vatBasis: VatBasis;
  /** a new value = read again (the report's rows changed) */
  refreshKey?: number | null;
  testID?: string;
}

export default function Monitor01ProjectStrip({ projectGUID, startDate, finishDate, vatBasis, refreshKey = null, testID = 'monitor01-strip' }: Monitor01ProjectStripProps) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const [months, setMonths] = useState<RoiMonthRow[] | null>(null);
  const from = parseDayInput(startDate);
  const to = parseDayInput(finishDate);
  useEffect(() => {
    let cancelled = false;
    const client: any = supabase;
    if (!client?.from) return undefined;
    (async () => {
      try {
        const rows = await fetchRoiMonthTotals(client, projectGUID ? [projectGUID] : null, from, to);
        if (!cancelled) setMonths(rows);
      } catch {
        if (!cancelled) setMonths(null);       // an old database without the month totals: no strip
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, projectGUID, from, to, refreshKey]);
  const strip = useMemo(() => (months ? roiStripOf(months, vatBasis, { from, to }) : null), [months, vatBasis, from, to]);
  if (!strip || roiStripIsEmpty(strip)) return null;
  const item = (id: string, label: string, value: number) => (
    <View key={id} style={styles.item}>
      <Text style={{ color: c.text, opacity: 0.65, fontSize: 11 }}>{pmT(label)}</Text>
      <Text testID={`${testID}-${id}`} style={{ color: c.text, fontWeight: '800', fontSize: 14 }}>{formatRoiMoney(value)}</Text>
    </View>
  );
  return (
    <View testID={testID} style={[styles.strip, { borderColor: c.border, backgroundColor: c.surface }]}>
      {item('costPlan', 'Budget (cost plan)', strip.costPlan)}
      {item('vendorInvoiced', 'Vendor Invoice Amount', strip.vendorInvoiced)}
      {item('customerInvoiced', 'Customer Invoice Amount', strip.customerInvoiced)}
      <Text style={{ color: c.text, opacity: 0.55, fontSize: 11 }}>{`${pmT(VAT_BASIS_SHORT[vatBasis])} · ${pmT('{{n}} months', { n: strip.months })}`}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24, marginHorizontal: 12, marginTop: 6, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  item: { gap: 1 },
});
