// ReusableTable - one cell: shows the value of a visualColumn and lets the user change it in place.
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../common/IconApp';
import SelectElementFromCatalog from '../../../../catalog/inner/select_element/SelectElementFromCatalog';
import type { ReusableTableRow, VisualColumn } from './reusableTableTypes';
import { asStringArray, cellValue, isHexColor, optionLabel, optionsOf, parseNumberInput, sanitizeNumberText, stepNumber } from './tableRows';
import ReusableTableOptionPicker from './ReusableTableOptionPicker';

export interface ReusableTableCellProps {
  col: VisualColumn;
  columns: VisualColumn[];
  row: ReusableTableRow;
  rowIndex: number;
  /** one cell changed (dependent cells are cleared by the table) */
  onChange: (columnKey: string, value: any) => void;
  /** custom cells: merge any rowJSON patch */
  onPatch: (rowJSONPatch: Record<string, any>) => void;
  /** catalog cells with detailsRoute: the "…" button was pressed for the selected GUID */
  onOpenDetails?: (col: VisualColumn, guid: string, row: ReusableTableRow) => void;
  /** uxuiTable.minimumTableRowHeight: low inputs */
  dense?: boolean;
  /** uxuiTable.roundedCells */
  rounded?: boolean;
  /** uxuiTable.borderedCells */
  bordered?: boolean;
  /** drag ghost: plain values, no inputs */
  readOnly?: boolean;
  testID: string;
}

export default function ReusableTableCell({ col, columns, row, rowIndex, onChange, onPatch, readOnly, rounded, bordered, dense, onOpenDetails, testID }: ReusableTableCellProps) {
  const radius = rounded ? 8 : 0;
  const border = bordered ? 1 : 0;
  const h = dense ? 30 : 40;
  const { themeColors: c } = useDesignSystem();
  const id = `${testID}-cell-${row.rowGUID}-${col.key}`;
  const align = col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left';

  if (col.type === 'rowNumber') {
    return <Text testID={id} style={{ color: c.text, opacity: 0.7, fontSize: 13, textAlign: col.align ?? 'center', flex: 1 }}>{rowIndex + 1}</Text>;
  }
  if (col.type === 'custom') return <>{col.renderCell(row, rowIndex, onPatch)}</>;

  const value = cellValue(row, col);
  const editable = col.editable !== false && !readOnly;

  if (col.type === 'catalog') {
    const parentCol = col.dependsOn ? columns.find((x) => x.key === col.dependsOn) : undefined;
    const parentValue = parentCol ? cellValue(row, parentCol) : undefined;
    const waitsForParent = !!col.dependsOn && !parentValue;
    const scopeByParent = !!col.dependsOn && col.dependsOnScopesCatalog !== false;
    return (
      <View style={styles.catalogCell}>
        <View style={styles.selectWrap}>
        <SelectElementFromCatalog
          testID={id}
          entityName={col.catalogEntityName}
          value={value ?? null}
          onChange={(guid) => onChange(col.key, guid)}
          // the rows of the element chosen in the column this one depends on (person -> his contracts)
          rowOwnerGUID={scopeByParent ? (parentValue ? String(parentValue) : undefined) : col.catalogRowOwnerGUID}
          rowParentGUID={col.catalogRowParentGUID}
          // every row of the table shares ONE read of the catalog; the owner filter is applied in memory
          scopeFetchByOwner={false}
          compact={dense}
          triggerStyle={{ ...(col.detailsRoute ? { paddingRight: 2 } : {}), borderRadius: radius, borderWidth: border, ...(bordered ? {} : { backgroundColor: 'transparent' }) }}
          filterItem={col.filterItem ? (catalogRow: any) => col.filterItem!(catalogRow, row) : undefined}
          placeholder={col.placeholder ?? 'Select…'}
          disabled={!editable || waitsForParent}
          disabledMessage={waitsForParent ? col.dependsOnMessage ?? 'Fill the previous column first' : undefined}
          {...(col.titleExtractor ? { titleExtractor: col.titleExtractor } : {})}
          {...(col.subtitleExtractor ? { subtitleExtractor: col.subtitleExtractor } : {})}
        />
        </View>
        {!!col.detailsRoute && !readOnly && (
          // "…" = go to the details of the selected element (dim until something is selected)
          <Pressable testID={`${id}-details`} accessibilityLabel={`Open ${col.title} details`} disabled={!value} hitSlop={4}
            onPress={() => value && onOpenDetails?.(col, String(value), row)} style={[styles.detailsBtn, { opacity: value ? 1 : 0.25 }]}>
            <IconApp name="more_horiz" size={14} color={c.text} />
          </Pressable>
        )}
      </View>
    );
  }

  if (col.type === 'integer' || col.type === 'number') {
    return <NumberCell testID={id} value={value} editable={editable} integer={col.type === 'integer'} min={col.min} max={col.max} radius={radius} border={border} h={h} stepper={col.stepper !== false} step={col.step} placeholder={col.placeholder} align={col.align ?? (col.stepper !== false ? 'center' : 'right')} onCommit={(n) => onChange(col.key, n)} />;
  }

  if (col.type === 'boolean') {
    const on = value === true;
    return (
      <Pressable testID={id} accessibilityRole="checkbox" aria-checked={on} disabled={!editable} onPress={() => onChange(col.key, !on)} hitSlop={6}
        style={[styles.boolCell, { justifyContent: col.align === 'left' ? 'flex-start' : col.align === 'right' ? 'flex-end' : 'center' }]}>
        <View style={[styles.boolBox, { borderColor: on ? c.primary : c.text + '80', backgroundColor: on ? c.primary : 'transparent', opacity: editable ? 1 : 0.6 }]}>
          {on ? <Text style={styles.boolTick}>✓</Text> : null}
        </View>
      </Pressable>
    );
  }

  if (col.type === 'select' || col.type === 'multiSelect') {
    const multi = col.type === 'multiSelect';
    const options = optionsOf(col, row);
    const selectedValues = multi ? asStringArray(value) : value === null || value === undefined || value === '' ? [] : [String(value)];
    const shown = selectedValues.map((v) => optionLabel(options, v)).join(', ');
    const dot = !multi && selectedValues[0] ? options.find((o) => o.value === selectedValues[0])?.color : undefined;
    return (
      <OptionCell testID={id} title={col.title} shown={shown} dot={dot} placeholder={col.placeholder ?? (multi ? 'Select…' : 'Select…')} editable={editable} h={h} radius={radius} border={border}
        options={options} multi={multi} selected={selectedValues} allowEmpty={col.type === 'select' ? col.allowEmpty !== false : true}
        onCommit={(next) => onChange(col.key, multi ? next : next[0] ?? null)} />
    );
  }

  if (col.type === 'color') {
    return (
      <View style={styles.colorCell}>
        <View testID={`${id}-swatch`} style={[styles.swatch, { borderColor: c.border, backgroundColor: isHexColor(value) ? String(value) : 'transparent' }]} />
        <TextCell radius={radius} border={border} h={h} testID={id} value={value} editable={editable} placeholder={col.placeholder ?? '#RRGGBB'} align="left" onCommit={(t) => onChange(col.key, t.trim() === '' ? null : t.trim())} />
      </View>
    );
  }

  if (col.type === 'json') {
    return <JsonCell testID={id} title={col.title} value={value} editable={editable} h={h} onCommit={(v) => onChange(col.key, v)} />;
  }

  if (col.type === 'date') {
    return <TextCell radius={radius} border={border} h={h} testID={id} value={value} editable={editable} placeholder={col.placeholder ?? 'YYYY-MM-DD'} align={align} onCommit={(t) => onChange(col.key, t.trim() === '' ? null : t.trim())} />;
  }

  return <TextCell radius={radius} border={border} h={h} testID={id} value={value} editable={editable} placeholder={col.placeholder} align={align} onCommit={(t) => onChange(col.key, t)} />;
}

/** select / multiSelect: the chosen labels; a press opens the picker */
function OptionCell({ testID, title, shown, dot, placeholder, editable, h, radius, border, options, multi, selected, allowEmpty, onCommit }: {
  testID: string; title: string; shown: string; dot?: string; placeholder: string; editable: boolean; h: number; radius: number; border: number;
  options: import('./reusableTableTypes').SelectOption[]; multi: boolean; selected: string[]; allowEmpty: boolean; onCommit: (values: string[]) => void;
}) {
  const { themeColors: c } = useDesignSystem();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable testID={testID} disabled={!editable} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${title}: ${shown || placeholder}`}
        style={[styles.optionTrigger, { height: h, borderRadius: radius, borderWidth: border, borderColor: c.border }]}>
        {dot ? <View style={[styles.dot, { backgroundColor: dot, borderColor: c.border }]} /> : null}
        <Text numberOfLines={1} style={{ flex: 1, color: c.text, opacity: shown ? 1 : 0.45, fontSize: 14 }}>{shown || placeholder}</Text>
        {editable ? <IconApp name="expand_more" size={16} color={c.text} /> : null}
      </Pressable>
      {open && (
        <ReusableTableOptionPicker testID={`${testID}-picker`} title={title} options={options} multi={multi} selected={selected} allowEmpty={allowEmpty}
          onClose={() => setOpen(false)} onPick={(values) => { setOpen(false); onCommit(values); }} />
      )}
    </>
  );
}

/** json: compact text; a press opens a window with the formatted JSON (saved only when it parses) */
function JsonCell({ testID, title, value, editable, h, onCommit }: { testID: string; title: string; value: any; editable: boolean; h: number; onCommit: (v: any) => void }) {
  const { themeColors: c } = useDesignSystem();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const compact = value === null || value === undefined ? '' : (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
  const save = () => {
    const t = (draft ?? '').trim();
    if (t === '') { onCommit(null); setDraft(null); return; }
    try { onCommit(JSON.parse(t)); setDraft(null); setError(''); } catch (e: any) { setError(`Not valid JSON: ${e?.message || e}`); }
  };
  return (
    <>
      <Pressable testID={testID} onPress={() => { setError(''); setDraft(value === null || value === undefined ? '' : JSON.stringify(value, null, 2)); }} style={[styles.optionTrigger, { height: h }]}>
        <Text numberOfLines={1} style={{ flex: 1, color: c.text, opacity: compact ? 0.85 : 0.45, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{compact || '{ }'}</Text>
      </Pressable>
      {draft !== null && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setDraft(null)}>
          <Pressable style={styles.backdrop} onPress={() => setDraft(null)}>
            <Pressable style={[styles.jsonWindow, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => {}}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>{title}</Text>
              <TextInput testID={`${testID}-editor`} multiline editable={editable} value={draft} onChangeText={setDraft} autoCapitalize="none" autoCorrect={false}
                style={[styles.jsonInput, { color: c.text, borderColor: error ? c.error : c.border }]} />
              {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, marginTop: 6 }}>{error}</Text>}
              <View style={styles.jsonButtons}>
                <Pressable testID={`${testID}-cancel`} onPress={() => setDraft(null)} style={[styles.jsonBtn, { borderColor: c.border }]}><Text style={{ color: c.text }}>Cancel</Text></Pressable>
                {editable && <Pressable testID={`${testID}-save`} onPress={save} style={[styles.jsonBtn, { borderColor: c.primary, backgroundColor: c.primary }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text></Pressable>}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

/** number input: free typing, saved on blur / Enter (only when the value really changed) */
function NumberCell({ radius, border, h, value, editable, integer, min, max, stepper, step, placeholder, align, onCommit, testID }: { radius: number; border: number; h: number; value: any; editable: boolean; integer: boolean; min?: number; max?: number; stepper: boolean; step?: number; placeholder?: string; align: 'left' | 'center' | 'right'; onCommit: (n: number | null) => void; testID: string }) {
  const { themeColors: c } = useDesignSystem();
  const shown = value === null || value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const commit = () => {
    const n = parseNumberInput(draft, { integer, min, max });
    setDraft(n === null ? '' : String(n));
    if ((n ?? null) !== (value ?? null)) onCommit(n);
  };
  if (!editable) return <Text testID={testID} style={{ color: c.text, flex: 1, textAlign: align, fontSize: 14 }}>{shown}</Text>;
  const input = (
    <TextInput
      testID={testID}
      value={draft}
      onChangeText={(t) => setDraft(sanitizeNumberText(t, integer, min === undefined || min < 0))}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      inputMode={integer ? 'numeric' : 'decimal'}
      placeholder={placeholder ?? '0'}
      placeholderTextColor={c.text + '60'}
      selectTextOnFocus
      style={[styles.input, { borderRadius: radius, borderWidth: border, height: h }, stepper && styles.inputInStepper, stepper && { height: h - 2 }, { color: c.text, borderColor: c.border, backgroundColor: border ? c.surface : 'transparent', textAlign: align }]}
    />
  );
  if (!stepper) return input;
  // − / +: from what is typed now (not yet saved) one step down / up
  const stepBy = (direction: 1 | -1) => {
    const from = parseNumberInput(draft, { integer, min, max });
    const n = stepNumber(from, direction, { step, integer, min, max });
    setDraft(String(n));
    if (n !== (value ?? null)) onCommit(n);
  };
  const current = parseNumberInput(draft, { integer, min, max });
  const atMin = min !== undefined && current !== null && current <= min;
  const atMax = max !== undefined && current !== null && current >= max;
  const btn = (direction: 1 | -1, disabled: boolean) => (
    <Pressable
      testID={`${testID}-${direction === 1 ? 'increase' : 'decrease'}`}
      accessibilityLabel={direction === 1 ? 'Increase' : 'Decrease'}
      disabled={disabled}
      onPress={() => stepBy(direction)}
      style={({ hovered, pressed }: any) => [styles.stepBtn, { opacity: disabled ? 0.3 : 1, backgroundColor: hovered || pressed ? c.primary + '22' : 'transparent' }]}
    >
      <Text style={{ color: c.primary, fontSize: 18, fontWeight: '700', lineHeight: 20 }}>{direction === 1 ? '+' : '−'}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.stepper, { height: h, borderRadius: radius, borderWidth: border, borderColor: c.border, backgroundColor: border ? c.surface : 'transparent' }]}>
      {btn(-1, atMin)}
      {input}
      {btn(1, atMax)}
    </View>
  );
}

function TextCell({ radius, border, h, value, editable, placeholder, align, onCommit, testID }: { radius: number; border: number; h: number; value: any; editable: boolean; placeholder?: string; align: 'left' | 'center' | 'right'; onCommit: (t: string) => void; testID: string }) {
  const { themeColors: c } = useDesignSystem();
  const shown = value === null || value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const commit = () => { if (draft !== shown) onCommit(draft); };
  if (!editable) return <Text testID={testID} numberOfLines={1} style={{ color: c.text, flex: 1, textAlign: align, fontSize: 14 }}>{shown}</Text>;
  return (
    <TextInput testID={testID} value={draft} onChangeText={setDraft} onBlur={commit} onSubmitEditing={commit} placeholder={placeholder} placeholderTextColor={c.text + '60'}
      style={[styles.input, { borderRadius: radius, borderWidth: border, height: h, color: c.text, borderColor: c.border, backgroundColor: border ? c.surface : 'transparent', textAlign: align }]} />
  );
}

const styles = StyleSheet.create({
  boolCell: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  boolBox: { width: 18, height: 18, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boolTick: { color: '#fff', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  optionTrigger: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  colorCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, marginLeft: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  jsonWindow: { width: '100%', maxWidth: 560, borderWidth: 1, borderRadius: 12, padding: 16 },
  jsonInput: { minHeight: 220, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, textAlignVertical: 'top', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }) },
  jsonButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  jsonBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center' },
  catalogCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  detailsBtn: { width: 18, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  // SelectElementFromCatalog has its own vertical margin: removed inside a table row
  selectWrap: { flex: 1, marginVertical: -6, minWidth: 0 },
  stepper: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, height: 40, overflow: 'hidden' },
  stepBtn: { width: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  inputInStepper: { borderWidth: 0, borderRadius: 0, paddingHorizontal: 2, height: 38 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 40, fontSize: 14, ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }) },
});
