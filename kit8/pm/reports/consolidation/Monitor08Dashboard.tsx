// Monitor08Dashboard - "Monitor08 Consolidation" (Drawer -> Reports; documentation/CONSOLIDATION_WBS.html section 5, README next to this file): the money of ALL the projects the user may read,
// added in the consolidation currency of the organization. The bar: the status of the consolidation (Ready / Recalculating / N gaps) + Refresh now, the currency basis, the period, by month.
//   Consolidation basis  the amounts are sumForConsolidation with the two VAT switches of the organization (the VAT basis selector is replaced by their words)
//   Project basis        each project in its own budget currency on the VAT basis of the report (VatBasisSelect); lines in different currencies are never added
// The twins are written by the database only (SQL PART 52); a posted document appears here at once, a changed currency / rate type after the worker has recalculated.
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme as usePaperTheme } from 'react-native-paper';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonTextApp from '../../../ui/components/common/ButtonTextApp';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import IconApp from '../../../ui/components/common/IconApp';
import { colorToHex } from '../../../ui/components/table/reusable/tableRows';
import { parseDayInput } from '../../../documents/fact/input/factInputModel';
import { pmT } from '../../i18n/pmT';
import { useVatBasis } from '../../vat/useVatBasis';
import VatBasisSelect from '../../vat/VatBasisSelect';
import { VAT_BASIS_TITLE } from '../../vat/vatBasis';
import CurrencyBasisSelect from '../common/CurrencyBasisSelect';
import ReportAgeBadge from '../common/ReportAgeBadge';
import { useCurrencyBasis } from '../common/useCurrencyBasis';
import { CONSOLIDATION_STATE_TEXT, consolidationVatWords } from '../../../catalog/organization/consolidation/consolidationModel';
import { useConsolidationStatus } from '../../../catalog/organization/consolidation/useConsolidationStatus';
import Monitor08Table from './Monitor08Table';
import { EMPTY_MONITOR08_FILTERS, buildMonitor08Lines, monitor08BasisText, monitor08Footer, type Monitor08Filters } from './monitor08Model';
import { useMonitor08Data } from './useMonitor08Data';

export default function Monitor08Dashboard({ testID = 'monitor08' }: { testID?: string }) {
  const { themeColors: c, isDark } = useDesignSystem();
  const paperTheme = usePaperTheme();
  const [filters, setFilters] = useState<Monitor08Filters>(EMPTY_MONITOR08_FILTERS);
  const [basis, setBasis] = useCurrencyBasis();
  const [vatBasis, setVatBasis] = useVatBasis();
  const dateError = {
    dateFrom: !!filters.dateFrom.trim() && parseDayInput(filters.dateFrom) === null,
    dateTo: !!filters.dateTo.trim() && parseDayInput(filters.dateTo) === null,
  };
  const from = dateError.dateFrom ? null : parseDayInput(filters.dateFrom);
  const to = dateError.dateTo ? null : parseDayInput(filters.dateTo);
  const data = useMonitor08Data({ from, to, byMonth: filters.byMonth });
  const { status, busy, refreshNow, reload: reloadStatus } = useConsolidationStatus(true);

  const lines = useMemo(() => buildMonitor08Lines(data.rows, basis, vatBasis), [data.rows, basis, vatBasis]);
  const footer = useMemo(() => monitor08Footer(lines), [lines]);
  const headerBackground = colorToHex((paperTheme?.colors as any)?.surfaceVariant || (isDark ? '#49454f' : '#e7e0ec'));
  const colors = useMemo(() => ({ text: c.text, border: c.border, surface: c.surface, primary: c.primary, headerBackground }), [c.text, c.border, c.surface, c.primary, headerBackground]);
  const stateColor = status?.state === 'ready' ? '#16a34a' : status?.state === 'gaps' ? '#c2410c' : c.primary;
  const basisText = monitor08BasisText(basis, status?.currency || '', status ? consolidationVatWords(status) : '', pmT(VAT_BASIS_TITLE[vatBasis]));
  const refresh = async () => { await refreshNow(); await data.reload(); await reloadStatus(); };

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="account_balance" size={20} color={c.primary} />
        <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Monitor08')}</Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('Consolidation')}</Text>
        <ButtonTextApp testID={`${testID}-refresh`} title={busy ? pmT('Refreshing ...') : pmT('Refresh now')} onPress={() => { if (!busy) void refresh(); }} />
        <View style={{ flex: 1 }} />
        <View testID={`${testID}-status`} style={styles.status}>
          <View style={[styles.dot, { backgroundColor: stateColor }]} />
          <Text testID={`${testID}-state`} style={{ color: c.text, fontSize: 12 }}>
            {status ? pmT(CONSOLIDATION_STATE_TEXT[status.state]) : pmT('Status is not available')}
            {status && status.gaps > 0 ? ` · ${pmT('{{n}} movement(s) without a rate', { n: status.gaps })}` : ''}
          </Text>
        </View>
        <ReportAgeBadge testID={`${testID}-age`} autoRefresh={false} live={false} changedAt={data.changedAt} />
      </View>
      <View style={styles.filters}>
        <View style={styles.field}>
          <DateInputApp testID={`${testID}-dateFrom`} label={pmT('startDate')} value={filters.dateFrom} onChangeText={(t) => setFilters((f) => ({ ...f, dateFrom: t }))} compact error={dateError.dateFrom} style={styles.input} />
        </View>
        <View style={styles.field}>
          <DateInputApp testID={`${testID}-dateTo`} label={pmT('finishDate')} value={filters.dateTo} onChangeText={(t) => setFilters((f) => ({ ...f, dateTo: t }))} compact error={dateError.dateTo} style={styles.input} />
        </View>
        <SwitchApp testID={`${testID}-byMonth`} label={pmT('By month')} value={filters.byMonth} onValueChange={(v) => setFilters((f) => ({ ...f, byMonth: v }))} />
        <CurrencyBasisSelect testID={`${testID}-currency-basis`} value={basis} onChange={setBasis} />
        {basis === 'project' && <VatBasisSelect testID={`${testID}-vat-basis`} value={vatBasis} onChange={setVatBasis} />}
      </View>
      <Text testID={`${testID}-basis-text`} style={{ color: c.text, opacity: 0.7, fontSize: 12, paddingHorizontal: 12, paddingBottom: 6 }}>{pmT(basisText)}</Text>
      {!!data.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{data.error}</Text>}
      {data.isLoading && data.rows.length === 0 && <Text testID={`${testID}-loading`} style={{ color: c.text, opacity: 0.6, padding: 12 }}>{pmT('Loading…')}</Text>}
      <View style={{ flex: 1 }}>
        <Monitor08Table testID={`${testID}-table`} lines={lines} footer={footer} colors={colors} byMonth={filters.byMonth} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  filters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  field: { width: 190 },
  input: { marginBottom: 0 },
});
