// EstimationSummaryPanel - the summary estimate of the project: every local / separate-costs document is a line of its chapter (1 - 12); totals after chapters 1-7, 1-8, 1-9, 1-12, the
// contingency (a % of 1-12) and the VAT (a % of 1-12 + contingency), in thousands. Reads the lines of ALL documents of the project and calculates each with the same engine as the board.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import SegmentButtonsApp from '../../../ui/components/common/SegmentButtonsApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import { readAllPages } from '../../crud/api/apiUtils';
import { pmT } from '../../i18n/pmT';
import { calcDocument, summaryEstimate, type ChapterRow, type CostBreakdown } from '../model/estimationCalc';
import type { DocumentRow, LineRow } from '../model/estimationDocumentModel';
import { ESTIMATION_TABLES, type EstimationObjectKind } from '../model/estimationModel';
import { summaryRowsOf } from '../export/estimationForms';

const fmt = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** the chapter rows of all the documents of a project (also used by the export) */
export async function readSummaryRows(client: any, projectGUID: string, documents: readonly DocumentRow[]): Promise<ChapterRow[]> {
  const lines = await readAllPages<LineRow>((from, to) => client.from(ESTIMATION_TABLES.line.table).select('*').eq('rowOwnerGUID', projectGUID).order('orderInList').order('rowGUID').range(from, to));
  const byDoc = new Map<string, LineRow[]>();
  for (const l of lines) { const d = l.rowJSON.documentGUID; if (!byDoc.has(d)) byDoc.set(d, []); byDoc.get(d)!.push(l); }
  return summaryRowsOf(documents.map((doc) => ({ doc, total: calcDocument(byDoc.get(doc.rowGUID) ?? [], doc.rowJSON).total as CostBreakdown })));
}

export interface EstimationSummaryPanelProps { client: any; projectGUID: string; documents: DocumentRow[]; currency: string; onSettings?: (s: { contingencyPct: number; vatPct: number; objectKind: EstimationObjectKind }) => void; testID?: string }

export default function EstimationSummaryPanel({ client, projectGUID, documents, currency, onSettings, testID = 'estimation-summary' }: EstimationSummaryPanelProps) {
  const { themeColors: c } = useDesignSystem();
  const [rows, setRows] = useState<ChapterRow[]>([]);
  const [error, setError] = useState('');
  const [contingency, setContingency] = useState('2');
  const [vat, setVat] = useState('20');
  const [kind, setKind] = useState<EstimationObjectKind>('nonProduction');
  useEffect(() => {
    let alive = true;
    readSummaryRows(client, projectGUID, documents).then((r) => alive && setRows(r)).catch((e) => alive && setError(String(e?.message ?? e)));
    return () => { alive = false; };
  }, [client, projectGUID, documents]);
  const cp = Number(contingency.replace(',', '.')) || 0;
  const vp = Number(vat.replace(',', '.')) || 0;
  useEffect(() => { onSettings?.({ contingencyPct: cp, vatPct: vp, objectKind: kind }); }, [cp, vp, kind, onSettings]);
  const s = useMemo(() => summaryEstimate(rows, { contingencyPct: cp, vatPct: vp, objectKind: kind }), [rows, cp, vp, kind]);
  const line = (label: string, cols: { construction: number; installation: number; equipment: number; other: number; total: number }, bold = false, key?: string) => (
    <View key={key ?? label} style={[styles.tr, { borderColor: c.border, backgroundColor: bold ? c.primary + '14' : 'transparent' }]}>
      <Text style={[styles.cName, { color: c.text, fontWeight: bold ? '700' : '400' }]} numberOfLines={2}>{label}</Text>
      {[cols.construction, cols.installation, cols.equipment, cols.other, cols.total].map((v, i) => <Text key={i} style={[styles.cNum, { color: c.text, fontWeight: bold || i === 4 ? '700' : '400' }]}>{v ? fmt(v) : ''}</Text>)}
    </View>
  );
  return (
    <ScrollView testID={testID} contentContainerStyle={{ gap: 12, paddingBottom: 30 }}>
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('Local estimates and estimates of separate costs go into their chapter (set in the settings of each document). Amounts in thousands, currency {{c}}.', { c: currency || '-' })}</Text>
      <View style={styles.row}>
        <View style={{ width: 170 }}><TextInputApp testID={`${testID}-contingency`} label={pmT('Contingency, %')} value={contingency} keyboardType="numeric" onChangeText={setContingency} /></View>
        <View style={{ width: 170 }}><TextInputApp testID={`${testID}-vat`} label={pmT('VAT, %')} value={vat} keyboardType="numeric" onChangeText={setVat} /></View>
        <SegmentButtonsApp testID={`${testID}-kind`} value={kind} onValueChange={setKind} buttons={[{ value: 'nonProduction', label: pmT('Non-production') }, { value: 'production', label: pmT('Production') }, { value: 'linear', label: pmT('Linear') }, { value: 'unique', label: pmT('Unique / hazardous') }]} />
      </View>
      {!!error && <Text style={{ color: c.error }}>{error}</Text>}
      {s.warnings.map((w) => <Text key={w} style={{ color: c.error, fontSize: 12 }}>{w}</Text>)}
      <ScrollView horizontal><View style={{ minWidth: 820 }}>
        <View style={[styles.tr, { borderColor: c.border, backgroundColor: c.border + '55' }]}>
          <Text style={[styles.cName, { color: c.text, fontWeight: '700' }]}>{pmT('Chapters, objects, works and costs')}</Text>
          {['Construction works', 'Installation works', 'Equipment', 'Other costs', 'Total'].map((h) => <Text key={h} style={[styles.cNum, { color: c.text, fontWeight: '700' }]}>{pmT(h)}</Text>)}
        </View>
        {s.chapters.map((ch) => (
          <React.Fragment key={ch.chapter}>
            {line(`${ch.chapter}. ${pmT(ch.title)}`, ch.cols)}
            {ch.chapter === 7 && line(pmT('Total, chapters 1 - 7'), s.after.to7, true)}
            {ch.chapter === 8 && line(pmT('Total, chapters 1 - 8'), s.after.to8, true)}
            {ch.chapter === 9 && line(pmT('Total, chapters 1 - 9'), s.after.to9, true)}
          </React.Fragment>
        ))}
        {line(pmT('Total, chapters 1 - 12'), s.after.to12, true)}
        {line(pmT('Contingency, {{p}} %', { p: cp }), s.contingency)}
        {line(pmT('VAT, {{p}} %', { p: vp }), s.vat)}
        {line(pmT('TOTAL WITH VAT'), s.grand, true)}
      </View></ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 6, paddingHorizontal: 6 },
  cName: { flex: 1, minWidth: 260, fontSize: 13 },
  cNum: { width: 110, textAlign: 'right', fontSize: 13 },
});
