// Monitor01EvmStrip (Extended C8 "Earned value") - the EVM line under the project strip of Monitor01: BAC, PV, EV, AC, SV, CV, SPI, CPI, EAC, ETC, VAC at the status date.
//   BAC = the budget (the Budget column: the cost plan) of the tasks in the bar        AC = the Vendor Invoice Amount (the money of the posted vendor invoices) of the same tasks
//   PV  = BAC of a task x the share of its dates that is behind the status date          EV = BAC x the % complete of the task
// The dates and the % complete come from the Gantt plan of the project (the PM store), so the strip shows only while that project is the one loaded on the dashboard.
// The same VAT basis as the rest of the screen (the rows are already on it). Not shown while the function is off.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { usePMStore } from '../../store/store_pm';
import { pmT } from '../../i18n/pmT';
import { projectEvm } from '../../extended/evm';
import { statusDateMsOf } from '../../extended/tracking';
import { formatRoiMoney } from '../roi/roiModel';
import type { Monitor01Row } from './monitor01Model';

/** the budget and the actual cost per task from the rows of the report (pure) */
export function evmInputsOf(rows: readonly Monitor01Row[], projectGUID: string): { budgetByTask: Record<string, number>; actualByTask: Record<string, number> } {
  const budgetByTask: Record<string, number> = {};
  const actualByTask: Record<string, number> = {};
  for (const r of rows) {
    if (r.rowProjectGUID !== projectGUID) continue;
    budgetByTask[r.rowOwnerGUID] = (budgetByTask[r.rowOwnerGUID] ?? 0) + r.sumForBudget;
    actualByTask[r.rowOwnerGUID] = (actualByTask[r.rowOwnerGUID] ?? 0) + r.sumVendorInvoiced;
  }
  return { budgetByTask, actualByTask };
}

export default function Monitor01EvmStrip({ rows, projectGUID, testID = 'monitor01-evm' }: { rows: readonly Monitor01Row[]; projectGUID: string | null; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const on = usePMStore((s) => s.extFlags.ganttEarnedValueEnabled === true);
  const loaded = usePMStore((s) => (projectGUID && s.loadedProjectGUID === projectGUID ? s : null));
  const statusDate = usePMStore((s) => s.extOptions.statusDate);
  const evm = useMemo(() => {
    if (!on || !projectGUID || !loaded) return null;
    const { budgetByTask, actualByTask } = evmInputsOf(rows, projectGUID);
    const progressByTask: Record<string, number> = {};
    for (const g of Object.keys(budgetByTask)) progressByTask[g] = loaded.schedule[g]?.progress ?? loaded.tasksById[g]?.rowProgress ?? 0;
    return projectEvm({ rows: loaded.schedule, budgetByTask, actualByTask, progressByTask, statusMs: statusDateMsOf(statusDate, Date.now()) }).total;
  }, [on, projectGUID, loaded, rows, statusDate]);
  if (!on) return null;
  if (!evm) return projectGUID ? (
    <View testID={testID} style={[styles.strip, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('Earned value: open this project on the Gantt chart (dates and % complete) to see PV, EV, SPI, CPI, EAC.')}</Text>
    </View>
  ) : null;
  const money = (v: number | null) => (v === null ? '—' : formatRoiMoney(v));
  const index = (v: number | null) => (v === null ? '—' : v.toFixed(2));
  const bad = (v: number | null) => v !== null && v < 1;
  const item = (id: string, label: string, value: string, warn = false) => (
    <View key={id} style={styles.item}>
      <Text style={{ color: c.text, opacity: 0.65, fontSize: 11 }}>{pmT(label)}</Text>
      <Text testID={`${testID}-${id}`} style={{ color: warn ? '#c2410c' : c.text, fontWeight: '800', fontSize: 14 }}>{value}</Text>
    </View>
  );
  return (
    <View testID={testID} style={[styles.strip, { borderColor: c.border, backgroundColor: c.surface }]}>
      {item('bac', 'BAC (budget)', money(evm.bac))}
      {item('pv', 'PV (planned value)', money(evm.pv))}
      {item('ev', 'EV (earned value)', money(evm.ev))}
      {item('ac', 'AC (actual cost)', money(evm.ac))}
      {item('sv', 'SV', money(evm.sv), evm.sv < 0)}
      {item('cv', 'CV', money(evm.cv), evm.cv < 0)}
      {item('spi', 'SPI', index(evm.spi), bad(evm.spi))}
      {item('cpi', 'CPI', index(evm.cpi), bad(evm.cpi))}
      {item('eac', 'EAC', money(evm.eac))}
      {item('etc', 'ETC', money(evm.etc))}
      {item('vac', 'VAC', money(evm.vac), (evm.vac ?? 0) < 0)}
      <Text style={{ color: c.text, opacity: 0.55, fontSize: 11 }}>{`${pmT('at the status date')} ${statusDateMsOf(statusDate, Date.now()) ? new Date(statusDateMsOf(statusDate, Date.now())).toISOString().slice(0, 10) : ''}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 18, marginHorizontal: 12, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  item: { gap: 1 },
});
