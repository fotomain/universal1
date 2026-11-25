// EstimationSettingsPanel - the settings of ONE estimate document (header, method, norms, index, rates of the three currencies, VAT, contingency, which columns are shown). Every field is a switch /
// an input of its own: the dashboard offers every option of the prototypes here. A change goes to the document at once (useEstimationData.changeDocument) and the sums follow.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import SegmentButtonsApp from '../../../ui/components/common/SegmentButtonsApp';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import { pmT } from '../../i18n/pmT';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import { contingencyCap } from '../model/estimationCalc';
import type { DocumentRow } from '../model/estimationDocumentModel';
import type { EstimationDocumentJSON, EstimationObjectKind } from '../model/estimationModel';
import { LAYOUT_COLUMNS, type EstimationLayout } from './EstimateSheet';

const numberText = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const parse = (t: string): number | undefined => { const n = Number(t.replace(',', '.')); return t.trim() !== '' && Number.isFinite(n) ? n : undefined; };

export interface EstimationSettingsPanelProps {
  document: DocumentRow;
  layout: EstimationLayout;
  readOnly: boolean;
  currencies: { budget: string; accounting: string; consolidation: string };
  gost: boolean;
  onChange: (patch: Partial<EstimationDocumentJSON> & Record<string, any>) => void;
  /** reads the exchange rates of the rate book: document currency -> the three currencies of the project (null = no rate) */
  onReadRates?: () => void;
  testID?: string;
}

export default function EstimationSettingsPanel({ document, layout, readOnly, currencies, gost, onChange, onReadRates, testID = 'estimation-settings' }: EstimationSettingsPanelProps) {
  const { themeColors: c } = useDesignSystem();
  const j = document.rowJSON as EstimationDocumentJSON & Record<string, any>;
  const h = j.header ?? {};
  const rates = j.rates ?? { budget: 1, accounting: 1, consolidation: 1 };
  const hidden = new Set<string>((j.hiddenColumns as string[]) ?? []);
  const text = (key: keyof typeof j & string, label: string, width = 260) => (
    <View style={{ width, minWidth: 160 }}><TextInputApp testID={`${testID}-${key}`} label={pmT(label)} value={String(j[key] ?? '')} disabled={readOnly} onChangeText={(t) => onChange({ [key]: t } as any)} /></View>
  );
  const number = (key: string, label: string, width = 150, value: unknown = j[key], set: (n: number | undefined) => void = (n) => onChange({ [key]: n } as any)) => (
    <View style={{ width, minWidth: 120 }}><TextInputApp testID={`${testID}-${key}`} label={pmT(label)} value={numberText(value)} disabled={readOnly} keyboardType="numeric" onChangeText={(t) => set(parse(t))} /></View>
  );
  const cap = contingencyCap(j.objectKind);

  return (
    <ScrollView testID={testID} style={styles.root} contentContainerStyle={{ gap: 14, paddingBottom: 30 }}>
      <Text style={[styles.h, { color: c.text }]}>{pmT('Document')}</Text>
      <View style={styles.row}>
        {text('title', 'Title', 360)}
        {text('cipher', 'Cipher')}
        {text('priceLevelDate', 'Price level date')}
        {text('currency', 'Currency of the numbers', 150)}
      </View>
      <SegmentButtonsApp
        testID={`${testID}-method`}
        value={j.method ?? 'baseIndex'}
        onValueChange={(m) => !readOnly && onChange({ method: m } as any)}
        buttons={[{ value: 'baseIndex', label: pmT('Base prices and an index') }, { value: 'commercial', label: pmT('Commercial') }, { value: 'resourceIndex', label: pmT('Resource and index (later)'), disabled: true }, { value: 'resource', label: pmT('Resource (later)'), disabled: true }]}
      />

      <Text style={[styles.h, { color: c.text }]}>{pmT('Norms, index and taxes')}</Text>
      <View style={styles.row}>
        {number('overheadPct', 'Overheads, % of payroll')}
        {number('profitPct', 'Profit, % of payroll')}
        {number('index', 'Index to current prices')}
        {number('vatPct', 'VAT, %')}
        {number('contingencyPct', 'Contingency, %')}
        {number('areaM2', 'Building area, m2')}
      </View>
      <SegmentButtonsApp
        testID={`${testID}-object-kind`}
        value={(j.objectKind ?? 'nonProduction') as EstimationObjectKind}
        onValueChange={(k) => !readOnly && onChange({ objectKind: k })}
        buttons={[{ value: 'nonProduction', label: pmT('Non-production') }, { value: 'production', label: pmT('Production') }, { value: 'linear', label: pmT('Linear') }, { value: 'unique', label: pmT('Unique / hazardous') }]}
      />
      <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('The contingency is usually not above {{cap}} % for this kind of object.', { cap })}</Text>

      <Text style={[styles.h, { color: c.text }]}>{pmT('Currencies: every sum is stored in all three')}</Text>
      <View style={styles.row}>
        {number('rate-budget', `${pmT('Rate to the budget currency')} (${currencies.budget || '-'})`, 230, rates.budget, (n) => onChange({ rates: { ...rates, budget: n ?? 1 } }))}
        {number('rate-accounting', `${pmT('Rate to the accounting currency')} (${currencies.accounting || '-'})`, 250, rates.accounting, (n) => onChange({ rates: { ...rates, accounting: n ?? 1 } }))}
        {number('rate-consolidation', `${pmT('Rate to the consolidation currency')} (${currencies.consolidation || '-'})`, 270, rates.consolidation, (n) => onChange({ rates: { ...rates, consolidation: n ?? 1 } }))}
        {!!onReadRates && <PMDialogButton testID={`${testID}-read-rates`} kind="secondary" icon="currency_exchange" title={pmT('Read the rates')} disabled={readOnly || !j.currency} onPress={onReadRates} />}
      </View>

      <Text style={[styles.h, { color: c.text }]}>{pmT('Summary estimate')}</Text>
      <View style={styles.row}>
        {number('chapter', 'Chapter (1 - 12)', 150)}
        <SegmentButtonsApp testID={`${testID}-work-kind`} value={(j.workKind as string) ?? (j.docKind === 'separate' ? 'other' : 'construction')} onValueChange={(k) => !readOnly && onChange({ workKind: k as 'construction' | 'installation' | 'other' })} buttons={[{ value: 'construction', label: pmT('Construction') }, { value: 'installation', label: pmT('Installation') }, { value: 'other', label: pmT('Other costs') }]} />
      </View>

      <Text style={[styles.h, { color: c.text }]}>{pmT('Header and signatures')}</Text>
      <View style={styles.row}>
        {[['client', 'Client'], ['basis', 'Basis (design documents)'], ['compiledBy', 'Compiled by'], ['checkedBy', 'Checked by'], ['approvedBy', 'Approved by']].map(([k, label]) => (
          <View key={k} style={{ width: 240, minWidth: 160 }}><TextInputApp testID={`${testID}-header-${k}`} label={pmT(label)} value={String((h as any)[k] ?? '')} disabled={readOnly} onChangeText={(t) => onChange({ header: { ...h, [k]: t } })} /></View>
        ))}
      </View>
      <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
        {gost ? pmT('The wording of the Methodology is used in the documents (Project settings -> Estimation).') : pmT('Neutral wording: no country-specific text or form number (Project settings -> Estimation).')}
      </Text>

      <Text style={[styles.h, { color: c.text }]}>{pmT('Columns of this layout')}</Text>
      <View style={styles.row}>
        {LAYOUT_COLUMNS[layout].map((col) => (
          <View key={col.key} style={{ minWidth: 220 }}>
            <SwitchApp testID={`${testID}-col-${col.key}`} label={pmT(col.title)} value={!hidden.has(col.key)} disabled={readOnly} onValueChange={(on) => { const next = new Set(hidden); if (on) next.delete(col.key); else next.add(col.key); onChange({ hiddenColumns: [...next] }); }} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  h: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
});
