// FactLinesTable - the lines of ONE tab (genus) of a fact input document.
//   columns   Date (editable in EVERY line) · Line (role · resource · unit) · Planned (the quantity of the task line, read only) · Qty (qtyForContract, editable) · Sum · delete
//   footer    totals per unit (hours and pieces are never added)
//   free mode [+ Add line] (role, unit, date, qty, price); strong mode: no add - only update and delete
// The table does not talk to the database: it calls onSave / onDelete / onAdd of the screen, which re-reads the rows (the database computes the sums).
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import TextInputApp from '../../ui/components/common/TextInputApp';
import ButtonApp from '../../ui/components/common/ButtonApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import { PMIconButton } from '../inner/buttons/PMIconButton';
import { pmT } from '../i18n/pmT';
import { rolesOfGenus } from '../view/task/finances/taskLineCatalogs';
import type { TaskLineCatalogData } from '../view/task/finances/taskLineCatalogs';
import { lineResourceTitle } from '../view/task/finances/taskLineResource';
import { taskLineGenusDef } from '../view/task/finances/taskLineModel';
import { rowTitle } from '../../catalog/product/crud/productCatalogTools';
import {
  FactHeaderView, FactLineJSON, FactLineRow, canAddLines, canDeleteLines, canEditLines, dayOfPeriod, dayToPeriodDatetime, factTotalsByUnit, formatQty, newFreeLine, parseDayInput, parseQtyInput,
} from './factInputModel';

/** a text field that keeps what the user types and commits it (blur / Enter) only when it is valid and changed; an invalid text is shown red and is dropped on blur */
function CommitField({ value, parse, onCommit, disabled, testID, width, keyboardType }: {
  value: string; parse: (text: string) => string | null; onCommit: (normalized: string) => void; disabled?: boolean; testID: string; width: number; keyboardType?: 'default' | 'numeric';
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = parse(text) !== null;
  const commit = () => {
    const normalized = parse(text);
    if (normalized === null) { setText(value); return; }
    if (normalized !== value) onCommit(normalized);
    setText(normalized);
  };
  return (
    <View style={{ width }}>
      <TextInputApp
        testID={testID}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        compact
        disabled={disabled}
        hideClearIcon
        error={!valid}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export interface FactLinesTableProps {
  header: FactHeaderView;
  genus: string;
  lines: FactLineRow[];
  data: TaskLineCatalogData;
  busy?: boolean;
  /** the lines a refused Post named: marked red */
  problemLines?: Set<string>;
  onSave: (lineGUID: string, patch: { rowPeriodDatetime?: string; qtyForContract?: number }) => void;
  onDelete: (lineGUID: string) => void;
  onAdd: (line: ReturnType<typeof newFreeLine>) => void;
  testID?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function FactLinesTable({ header, genus, lines, data, busy, problemLines, onSave, onDelete, onAdd, testID = 'fact-lines' }: FactLinesTableProps) {
  const { themeColors: c } = useDesignSystem();
  const def = taskLineGenusDef(genus);
  const editable = canEditLines(header);
  const roleTitle = (id?: string) => (id ? rowTitle(data.resourceRole.find((r) => r.rowGUID === id)) : '');
  const unitTitle = (id?: string) => (id ? rowTitle(data.measureUnit.find((r) => r.rowGUID === id)) : '');
  const totals = useMemo(() => factTotalsByUnit(lines), [lines]);

  // the form of a new line (free mode)
  const [role, setRole] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [day, setDay] = useState(today());
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const roleItems = useMemo(() => rolesOfGenus(data, genus).map((r) => ({ value: r.rowGUID, label: rowTitle(r) })), [data, genus]);
  const unitItems = useMemo(() => data.measureUnit.map((r) => ({ value: r.rowGUID, label: rowTitle(r) })), [data]);
  const dayOk = parseDayInput(day) !== null;
  const qtyOk = parseQtyInput(qty) !== null;
  const priceOk = price.trim() === '' || parseQtyInput(price) !== null;
  const canSubmit = !busy && dayOk && qtyOk && priceOk && !!unit;
  const submit = () => {
    const d = parseDayInput(day);
    const q = parseQtyInput(qty);
    if (!d || q === null || !unit) return;
    const json: FactLineJSON = { measureUnitTaskLine: unit };
    if (role) json.resourceRoleItem = role;
    const p = price.trim() === '' ? null : parseQtyInput(price);
    if (p !== null) json.priceTaskLine = p;
    const next = Math.max(0, ...lines.map((l) => Number(l.orderInList) || 0)) + 1;
    onAdd({ ...newFreeLine(header, genus, d, next, json), qtyForContract: q });
    setQty('');
  };

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.row, styles.head, { borderBottomColor: c.border }]}>
        <Text style={[styles.hcell, { width: 118, color: c.text }]}>{pmT('Date')}</Text>
        <Text style={[styles.hcell, { flex: 1, minWidth: 160, color: c.text }]}>{pmT('Line')}</Text>
        <Text style={[styles.hcell, styles.num, { width: 80, color: c.text }]}>{pmT('Planned')}</Text>
        <Text style={[styles.hcell, styles.num, { width: 96, color: c.text }]}>{pmT('Qty')}</Text>
        <Text style={[styles.hcell, styles.num, { width: 90, color: c.text }]}>{pmT('Sum')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {lines.length === 0 && (
        <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.6, padding: 12 }}>
          {canAddLines(header) ? pmT('No lines on this tab. Press "+ Add line".') : pmT('No lines on this tab.')}
        </Text>
      )}

      {lines.map((l) => {
        const resource = def ? lineResourceTitle(data, def, l.rowJSON as any) : '';
        const description = [roleTitle(l.rowJSON?.resourceRoleItem), resource].filter(Boolean).join(' · ') || pmT('(no role)');
        const unitLabel = unitTitle(l.rowJSON?.measureUnitTaskLine);
        return (
          <View key={l.rowGUID} testID={`${testID}-row-${l.rowGUID}`} style={[styles.row, { borderBottomColor: c.border }, problemLines?.has(l.rowGUID) ? { borderLeftWidth: 3, borderLeftColor: c.error } : null]}>
            <CommitField
              testID={`${testID}-date-${l.rowGUID}`}
              width={118}
              value={dayOfPeriod(l.rowPeriodDatetime)}
              disabled={!editable || busy}
              parse={parseDayInput}
              onCommit={(d) => onSave(l.rowGUID, { rowPeriodDatetime: dayToPeriodDatetime(d) })}
            />
            <View style={{ flex: 1, minWidth: 160, paddingHorizontal: 6 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontSize: 13 }}>{description}</Text>
              <Text numberOfLines={1} style={{ color: c.text, opacity: 0.55, fontSize: 11 }}>{unitLabel}{l.taskLineGUID ? '' : header.strong ? ` · ${pmT('task line deleted')}` : ''}</Text>
            </View>
            <Text testID={`${testID}-planned-${l.rowGUID}`} style={[styles.cell, styles.num, { width: 80, color: c.text, opacity: 0.7 }]}>{formatQty(l.qtyForBudget)}</Text>
            <CommitField
              testID={`${testID}-qty-${l.rowGUID}`}
              width={96}
              value={formatQty(l.qtyForContract) || '0'}
              disabled={!editable || busy}
              keyboardType="numeric"
              parse={(t) => { const n = parseQtyInput(t); return n === null ? null : formatQty(n) || '0'; }}
              onCommit={(q) => onSave(l.rowGUID, { qtyForContract: Number(q) })}
            />
            <Text testID={`${testID}-sum-${l.rowGUID}`} style={[styles.cell, styles.num, { width: 90, color: c.text }]}>{l.sumForContract == null ? '' : l.sumForContract.toFixed(2)}</Text>
            <View style={{ width: 36, alignItems: 'center' }}>
              {canDeleteLines(header) && (
                <PMIconButton tipScope="app" testID={`${testID}-delete-${l.rowGUID}`} icon="delete" title={pmT('Delete the line')} color={c.text} onPress={() => onDelete(l.rowGUID)} />
              )}
            </View>
          </View>
        );
      })}

      {totals.length > 0 && (
        <View testID={`${testID}-totals`} style={styles.totals}>
          {totals.map((t) => (
            <Text key={t.unit || 'none'} testID={`${testID}-total-${t.unit || 'none'}`} style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>
              {pmT('Total')} {unitTitle(t.unit) || pmT('(no unit)')}: {formatQty(t.qty) || '0'}{t.sumForContract == null ? '' : ` · ${t.sumForContract.toFixed(2)}`}
            </Text>
          ))}
        </View>
      )}

      {canAddLines(header) && (
        <View testID={`${testID}-add`} style={[styles.add, { borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 13, marginBottom: 6 }}>{pmT('+ Add line')}</Text>
          <View style={styles.addRow}>
            <View style={{ minWidth: 200, flexGrow: 1 }}>
              <SelectItemFromListApp testID={`${testID}-add-role`} label={pmT('Role')} items={roleItems} value={role} onSelect={setRole} placeholder={pmT('No role')} />
            </View>
            <View style={{ minWidth: 140 }}>
              <SelectItemFromListApp testID={`${testID}-add-unit`} label={pmT('Unit')} items={unitItems} value={unit} onSelect={setUnit} placeholder={pmT('Unit')} />
            </View>
            <View style={{ width: 130 }}>
              <TextInputApp testID={`${testID}-add-date`} label={pmT('Date')} value={day} onChangeText={setDay} compact error={!dayOk} hideClearIcon />
            </View>
            <View style={{ width: 90 }}>
              <TextInputApp testID={`${testID}-add-qty`} label={pmT('Qty')} value={qty} onChangeText={setQty} compact keyboardType="numeric" error={qty !== '' && !qtyOk} hideClearIcon />
            </View>
            <View style={{ width: 90 }}>
              <TextInputApp testID={`${testID}-add-price`} label={pmT('Price')} value={price} onChangeText={setPrice} compact keyboardType="numeric" error={!priceOk} hideClearIcon />
            </View>
            <ButtonApp testID={`${testID}-add-submit`} title={pmT('Add line')} icon="add" size="small" disabled={!canSubmit} onPress={submit} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  head: { paddingVertical: 6 },
  hcell: { fontSize: 12, fontWeight: '700', paddingHorizontal: 6 },
  cell: { fontSize: 13, paddingHorizontal: 6 },
  num: { textAlign: 'right' },
  totals: { paddingVertical: 8, paddingHorizontal: 6, gap: 2, alignItems: 'flex-end' },
  add: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, marginTop: 10 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8 },
});
