// ReusableTable - one cell: shows the value of a visualColumn and lets the user change it in place.
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../common/IconApp';
import SelectElementFromCatalog from '../../../../catalog/inner/select_element/SelectElementFromCatalog';
import type { ReusableTableRow, VisualColumn } from './reusableTableTypes';
import { fieldOf, parseNumberInput, sanitizeNumberText, stepNumber } from './tableRows';

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
  const json = row.rowJSON || {};
  const id = `${testID}-cell-${row.rowGUID}-${col.key}`;
  const align = col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left';

  if (col.type === 'rowNumber') {
    return <Text testID={id} style={{ color: c.text, opacity: 0.7, fontSize: 13, textAlign: col.align ?? 'center', flex: 1 }}>{rowIndex + 1}</Text>;
  }
  if (col.type === 'custom') return <>{col.renderCell(row, rowIndex, onPatch)}</>;

  const value = json[fieldOf(col)];
  const editable = col.editable !== false && !readOnly;

  if (col.type === 'catalog') {
    const parentCol = col.dependsOn ? columns.find((x) => x.key === col.dependsOn) : undefined;
    const parentValue = parentCol ? json[fieldOf(parentCol)] : undefined;
    const waitsForParent = !!col.dependsOn && !parentValue;
    return (
      <View style={styles.catalogCell}>
        <View style={styles.selectWrap}>
        <SelectElementFromCatalog
          testID={id}
          entityName={col.catalogEntityName}
          value={value ?? null}
          onChange={(guid) => onChange(col.key, guid)}
          // the rows of the element chosen in the column this one depends on (person -> his contracts)
          rowOwnerGUID={col.dependsOn ? (parentValue ? String(parentValue) : undefined) : col.catalogRowOwnerGUID}
          rowParentGUID={col.catalogRowParentGUID}
          // every row of the table shares ONE read of the catalog; the owner filter is applied in memory
          scopeFetchByOwner={false}
          compact={dense}
          triggerStyle={{ ...(col.detailsRoute ? { paddingRight: 2 } : {}), borderRadius: radius, borderWidth: border, ...(bordered ? {} : { backgroundColor: 'transparent' }) }}
          filterItem={col.filterItem}
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

  return <TextCell radius={radius} border={border} h={h} testID={id} value={value} editable={editable} placeholder={col.placeholder} align={align} onCommit={(t) => onChange(col.key, t)} />;
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
  catalogCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  detailsBtn: { width: 18, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  // SelectElementFromCatalog has its own vertical margin: removed inside a table row
  selectWrap: { flex: 1, marginVertical: -6, minWidth: 0 },
  stepper: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, height: 40, overflow: 'hidden' },
  stepBtn: { width: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  inputInStepper: { borderWidth: 0, borderRadius: 0, paddingHorizontal: 2, height: 38 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 40, fontSize: 14, ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }) },
});
