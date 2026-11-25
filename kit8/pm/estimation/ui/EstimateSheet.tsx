// EstimateSheet - the board of ONE estimate document: every cell is edited in place (ReusableTable in local rows mode), every change recalculates the sums (estimationCalc) and is saved by
// useEstimationData. FOUR LAYOUTS over the same lines (the user switches between them, nothing is converted):
//   simple    the estimate sheet: position, norm, unit, quantity, coefficient, unit costs (labour, machines, operators, materials), direct costs and the total in current prices
//   advanced  everything: all six cost elements, overhead / profit / index per line, the catalogs of the app (budget item, business unit), the takeoff reference, every cost element in the table and
//             the total in the budget, accounting and consolidation currency (the resource matrix)
//   quote     the quick quote: category, description, unit, quantity, cost per unit, mark-up, price, status
//   trades    the trade breakdown: a position per trade, labour and materials, total, cost per m2, share
// There are NO sections to add: the hierarchy is the task tree on the left. A line is a POSITION; its norm is SELECTED from the norm book (the button of the norm column opens the norm books).
// Sections of an older document (examples, imports) are still shown and calculated, only new ones cannot be made.
// The columns the user hides are kept in the document (rowJSON.hiddenColumns).
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { pmNumberColumn } from '../../components/pmNumberColumn';
import { pmT } from '../../i18n/pmT';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import IconLinkAction from './IconLinkAction';
import { round2, type DocumentCalc } from '../model/estimationCalc';
import { applyTableRows, type DocumentRow, type LineRow } from '../model/estimationDocumentModel';
import { BASIS_TO_SUM_KEY, ESTIMATION_TABLES, type EstimationCurrencyBasis } from '../model/estimationModel';

export type EstimationLayout = 'simple' | 'advanced' | 'quote' | 'trades';
/** `tip` = the NAME first, the description after it (the hover tip of the button; pass through pmT) */
export const ESTIMATION_LAYOUTS: { value: EstimationLayout; label: string; tip: string }[] = [
  { value: 'simple', label: 'Estimate sheet', tip: 'Estimate sheet: one line per work with the quantity, the price and the total; the shortest way to type an estimate.' },
  { value: 'advanced', label: 'Advanced (resource matrix)', tip: 'Advanced (resource matrix): every line split into labour, machines, operators, materials and other cost, with the overheads and the profit.' },
  { value: 'quote', label: 'Quick quote', tip: 'Quick quote: a short list of items and prices for a customer offer, without the cost build-up.' },
  { value: 'trades', label: 'Trade breakdown', tip: 'Trade breakdown: the lines grouped by trade, with a subtotal for each trade.' },
];

const T = ESTIMATION_TABLES.line.table;

/** the columns the user may hide per layout (the others - the description - always stay) */
export const LAYOUT_COLUMNS: Record<EstimationLayout, { key: string; title: string }[]> = {
  simple: [['normCode', 'Norm / justification'], ['unit', 'Unit'], ['qty', 'Quantity'], ['coefficient', 'Coef.'], ['unitLabour', 'Labour / unit'], ['unitMachines', 'Machines / unit'], ['unitOperators', 'of which operators'], ['unitMaterials', 'Materials / unit'], ['direct', 'Direct costs'], ['current', 'Total, current prices'], ['sumShown', 'Total, current prices']].map(([key, title]) => ({ key, title })),
  advanced: [['normCode', 'Norm / justification'], ['unit', 'Unit'], ['overheadPct', 'Overheads, %'], ['profitPct', 'Profit, %'], ['index', 'Index'], ['budgetItemGUID', 'Budget item'], ['businessUnitGUID', 'Business unit'], ['takeoffRef', 'Takeoff ref.'], ['c-labour', 'Labour'], ['c-machines', 'Machines'], ['c-operators', 'Operators'], ['c-materials', 'Materials'], ['c-other', 'Other'], ['c-equipment', 'Equipment'], ['payroll', 'Payroll'], ['overheads', 'Overheads'], ['profit', 'Profit'], ['base', 'Total, base prices'], ['sumForBudget', 'Budget currency'], ['sumForAccounting', 'Accounting currency'], ['sumForConsolidation', 'Consolidation currency']].map(([key, title]) => ({ key, title })),
  quote: [['category', 'Category'], ['unit', 'Unit'], ['status', 'Status'], ['markupPct', 'Mark-up, %']].map(([key, title]) => ({ key, title })),
  trades: [['perArea', 'Per m2'], ['share', 'Share']].map(([key, title]) => ({ key, title })),
};
const fmt = (n: number | undefined | null, d = 2): string => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '');

export interface EstimateSheetProps {
  projectGUID: string;
  document: DocumentRow;
  lines: LineRow[];
  calc: DocumentCalc;
  layout: EstimationLayout;
  basis: EstimationCurrencyBasis;
  readOnly: boolean;
  onChangeLines: (fn: (prev: LineRow[]) => LineRow[]) => void;
  onDeleteLines: (guids: string[]) => void;
  /** the task tree is on: a new position is given to this task (null = none) */
  newLineTaskGUID?: string | null;
  /** a stage is picked in the tree: positions belong to a task, so adding is off */
  addBlocked?: boolean;
  /** the whole estimate is shown and a task is picked: the button gives the checked lines to it */
  assignTo?: { guid: string; title: string } | null;
  onAssign?: (guids: string[]) => void;
  /** the user pressed the norm button of a position: the dashboard opens the norm books and writes the chosen norm into that line (absent = the norm is typed) */
  onSelectNorm?: (lineGUID: string) => void;
  testID?: string;
}

/** the narrowest an edited number column may be: the minus / plus buttons and the calculator icon leave little room for the digits (as VAT_PERCENT_COLUMN_WIDTH, wider: the unit costs have up to 10 characters, e.g. 5049.9477) */
export const ESTIMATE_NUMBER_COLUMN_MIN_WIDTH = 210;
/** a number column: edited in place with the calculator of the app */
const num = (key: string, title: string, width: number, extra: Partial<VisualColumn> = {}): VisualColumn =>
  ({ key, title: pmT(title), type: 'number', width: Math.max(width, ESTIMATE_NUMBER_COLUMN_MIN_WIDTH), align: 'right', total: false, min: 0, max: 1e12, ...pmNumberColumn(T, key), ...extra } as VisualColumn);

export default function EstimateSheet({ projectGUID, document, lines, calc, layout, basis, readOnly, onChangeLines, onDeleteLines, newLineTaskGUID = null, addBlocked = false, assignTo = null, onAssign, onSelectNorm, testID = 'estimation-sheet' }: EstimateSheetProps) {
  const { themeColors: c } = useDesignSystem();
  const [selected, setSelected] = useState<string[]>([]);
  const hidden = useMemo(() => new Set<string>(((document.rowJSON as any).hiddenColumns as string[]) ?? []), [document]);
  const docGUID = document.rowGUID;
  const sumKey = BASIS_TO_SUM_KEY[basis];
  const area = Number((document.rowJSON as any).areaM2) || 0;
  const totalCurrent = calc.total.current || 0;

  const costCell = (pick: (k: ReturnType<typeof costOf>) => number, bold = false) => (row: any) => {
    const v = pick(costOf(calc, row.rowGUID));
    return <Text testID={`est-cost-${row.rowGUID}`} style={{ color: c.text, fontSize: 13, textAlign: 'right', fontWeight: bold || row.rowJSON?.lineKind === 'section' ? '700' : '400' }}>{v ? fmt(v) : ''}</Text>;
  };
  const calcCol = (key: string, title: string, width: number, pick: (k: ReturnType<typeof costOf>) => number, bold = false): VisualColumn =>
    ({ key, title: pmT(title), type: 'custom', width, editable: false, align: 'right', renderCell: costCell(pick, bold), searchText: () => '' } as VisualColumn);

  const columns = useMemo<VisualColumn[]>(() => {
    const structure: VisualColumn = {
      key: 'structure', title: pmT('Structure'), type: 'custom', width: 150, editable: false, pinFirst: true,
      renderCell: (row: any) => {
        const depth = calc.order.find((o) => o.rowGUID === row.rowGUID)?.depth ?? 0;
        const kind = row.rowJSON?.lineKind;
        return <Text numberOfLines={1} style={{ color: c.text, fontSize: 12, paddingLeft: depth * 12, fontWeight: kind === 'section' ? '700' : '400', opacity: kind === 'section' ? 1 : 0.7 }}>{kind === 'section' ? `▾ ${pmT('Section')}` : pmT('Position')}</Text>;
      },
      searchText: () => '',
    } as VisualColumn;
    const title: VisualColumn = { key: 'title', title: pmT('Description'), type: 'text', width: 320 };
    // a position takes its norm from the norm book (the button); without the picker (or read only) the code is plain text
    const norm: VisualColumn = onSelectNorm
      ? {
        key: 'normCode', title: pmT('Norm / justification'), type: 'custom', width: 200, align: 'center', editable: false,
        renderCell: (row: any) => (row.rowJSON?.lineKind !== 'position' ? null
          // a HYPERLINK with the icon (not a button), centred in the cell
          : <IconLinkAction testID={`${testID}-norm-${row.rowGUID}`} icon="menu_book" title={row.rowJSON?.normCode ? String(row.rowJSON.normCode) : pmT('Select norm')} disabled={readOnly} onPress={() => onSelectNorm(row.rowGUID)} />),
        searchText: (row: any) => String(row.rowJSON?.normCode ?? ''),
      } as VisualColumn
      : { key: 'normCode', title: pmT('Norm / justification'), type: 'text', width: 170 };
    const unit: VisualColumn = { key: 'unit', title: pmT('Unit'), type: 'text', width: 90 };
    const qty = num('qty', 'Quantity', 110);
    const coef = num('coefficient', 'Coef.', 90, { min: 0.0001, max: 1000, placeholder: '1' });
    const uL = num('unitLabour', 'Labour / unit', 120);
    const uM = num('unitMachines', 'Machines / unit', 130);
    const uO = num('unitOperators', 'of which operators', 130);
    const uMat = num('unitMaterials', 'Materials / unit', 130);
    const uOth = num('unitOther', 'Other / unit', 110);
    const uEq = num('unitEquipment', 'Equipment / unit', 130);
    const sums: VisualColumn[] = [
      { key: 'sumShown', title: pmT('Total, current prices'), type: 'custom', width: 150, editable: false, align: 'right', renderCell: (row: any) => <Text style={{ color: c.text, fontSize: 13, textAlign: 'right', fontWeight: '700' }}>{fmt(row.rowJSON?.[sumKey])}</Text>, searchText: () => '' } as VisualColumn,
    ];
    let cols: VisualColumn[];
    if (layout === 'simple') {
      cols = [structure, title, norm, unit, qty, coef, uL, uM, uO, uMat, calcCol('direct', 'Direct costs', 130, (k) => k.direct), calcCol('current', 'Total, current prices', 150, (k) => k.current, true)];
    } else if (layout === 'advanced') {
      cols = [
        structure, title, norm, unit, qty, coef, uL, uM, uO, uMat, uOth, uEq,
        num('overheadPct', 'Overheads, %', 110, { max: 1000 }), num('profitPct', 'Profit, %', 100, { max: 1000 }), num('index', 'Index', 90, { max: 1e6 }),
        { key: 'budgetItemGUID', title: pmT('Budget item'), type: 'catalog', catalogEntityName: 'budgetItemReusable', width: 200, placeholder: pmT('Budget item') } as VisualColumn,
        { key: 'businessUnitGUID', title: pmT('Business unit'), type: 'catalog', catalogEntityName: 'businessUnitReusable', width: 180, placeholder: pmT('Business unit') } as VisualColumn,
        { key: 'takeoffRef', title: pmT('Takeoff ref.'), type: 'text', width: 110 },
        calcCol('c-labour', 'Labour', 110, (k) => k.labour), calcCol('c-machines', 'Machines', 110, (k) => k.machines), calcCol('c-operators', 'Operators', 100, (k) => k.operators), calcCol('c-materials', 'Materials', 120, (k) => k.materials),
        calcCol('c-other', 'Other', 90, (k) => k.other), calcCol('c-equipment', 'Equipment', 110, (k) => k.equipment), calcCol('direct', 'Direct costs', 130, (k) => k.direct), calcCol('payroll', 'Payroll', 110, (k) => k.payroll),
        calcCol('overheads', 'Overheads', 110, (k) => k.overheads), calcCol('profit', 'Profit', 100, (k) => k.profit), calcCol('base', 'Total, base prices', 140, (k) => k.base), calcCol('current', 'Total, current prices', 150, (k) => k.current, true),
        { key: 'sumForBudget', title: pmT('Budget currency'), type: 'custom', width: 130, editable: false, align: 'right', renderCell: (r: any) => <Text style={{ color: c.text, fontSize: 12, textAlign: 'right' }}>{fmt(r.rowJSON?.sumForBudget)}</Text>, searchText: () => '' } as VisualColumn,
        { key: 'sumForAccounting', title: pmT('Accounting currency'), type: 'custom', width: 140, editable: false, align: 'right', renderCell: (r: any) => <Text style={{ color: c.text, fontSize: 12, textAlign: 'right' }}>{fmt(r.rowJSON?.sumForAccounting)}</Text>, searchText: () => '' } as VisualColumn,
        { key: 'sumForConsolidation', title: pmT('Consolidation currency'), type: 'custom', width: 150, editable: false, align: 'right', renderCell: (r: any) => <Text style={{ color: c.text, fontSize: 12, textAlign: 'right' }}>{fmt(r.rowJSON?.sumForConsolidation)}</Text>, searchText: () => '' } as VisualColumn,
      ];
    } else if (layout === 'quote') {
      cols = [
        { key: 'category', title: pmT('Category'), type: 'text', width: 190 }, title, unit, qty, num('unitOther', 'Cost per unit', 120),
        calcCol('cost', 'Cost', 120, (k) => k.direct), num('markupPct', 'Mark-up, %', 100, { max: 1000 }),
        { key: 'price', title: pmT('Price'), type: 'custom', width: 130, editable: false, align: 'right', renderCell: (row: any) => <Text style={{ color: c.text, fontSize: 13, textAlign: 'right', fontWeight: '700' }}>{fmt(round2((costOf(calc, row.rowGUID).direct || 0) * (1 + (Number(row.rowJSON?.markupPct) || 0) / 100)))}</Text>, searchText: () => '' } as VisualColumn,
        { key: 'status', title: pmT('Status'), type: 'select', width: 120, options: [{ value: 'Open', label: pmT('Open') }, { value: 'Complete', label: pmT('Complete') }] } as VisualColumn,
      ];
    } else {
      cols = [
        { ...structure, width: 120 }, { key: 'title', title: pmT('Trade / description'), type: 'text', width: 260 }, num('unitLabour', 'Labour', 120), num('unitMaterials', 'Materials', 120),
        calcCol('current', 'Total, current prices', 150, (k) => k.current, true),
        { key: 'perArea', title: pmT('Per m2'), type: 'custom', width: 110, editable: false, align: 'right', renderCell: (row: any) => <Text style={{ color: c.text, fontSize: 13, textAlign: 'right' }}>{area ? fmt((costOf(calc, row.rowGUID).current || 0) / area) : ''}</Text>, searchText: () => '' } as VisualColumn,
        { key: 'share', title: pmT('Share'), type: 'custom', width: 150, editable: false, renderCell: (row: any) => { const p = totalCurrent ? (costOf(calc, row.rowGUID).current || 0) / totalCurrent : 0; return <View style={{ height: 8, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden', width: 120 }}><View style={{ width: Math.max(1, Math.round(120 * Math.min(1, p))), height: 8, backgroundColor: c.primary }} /></View>; }, searchText: () => '' } as VisualColumn,
      ];
    }
    if (layout !== 'advanced' && layout !== 'quote' && layout !== 'trades') cols = [...cols];
    if (layout === 'simple') cols = [...cols, ...sums];
    return cols.filter((col) => !hidden.has(col.key) || col.key === 'title');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, calc, sumKey, hidden, area, totalCurrent, readOnly, onSelectNorm, testID, c.text, c.border, c.primary]);

  const rows = useMemo<ReusableTableRow[]>(() => {
    const by = new Map(lines.map((l) => [l.rowGUID, l]));
    return calc.order.map((o) => by.get(o.rowGUID)).filter(Boolean).map((l) => ({ rowGUID: l!.rowGUID, rowOwnerGUID: l!.rowOwnerGUID, rowParentGUID: l!.rowParentGUID, orderInList: l!.orderInList, rowJSON: l!.rowJSON }));
  }, [lines, calc]);

  // every change of the user in the table (a cell, a new / duplicated / deleted / moved row: the toolbar and the row menu of the table do them) becomes the new lines of the document
  const onRows = useCallback((next: ReusableTableRow[]) => {
    onChangeLines((prev) => applyTableRows(prev, lines, next, { projectGUID, documentGUID: docGUID, taskGUID: newLineTaskGUID }));
    setSelected((sel) => sel.filter((g) => next.some((r) => r.rowGUID === g)));
  }, [onChangeLines, lines, projectGUID, docGUID, newLineTaskGUID]);
  // a new row of the table is a POSITION of this document, given to the task picked in the tree
  const defaultRowJSON = useCallback(() => ({ documentGUID: docGUID, lineKind: 'position', title: '', qty: 1, unit: '', ...(newLineTaskGUID ? { taskGUID: newLineTaskGUID } : {}) }), [docGUID, newLineTaskGUID]);

  return (
    <View testID={testID} style={styles.root}>
      <View style={styles.bar}>
        {!!assignTo && !!onAssign && (
          <PMDialogButton testID={`${testID}-assign`} kind="secondary" icon="assignment_ind" title={pmT('Give the checked lines to: {{n}}', { n: assignTo.title })} disabled={readOnly || !selected.length} onPress={() => { onAssign(selected); setSelected([]); }} />
        )}
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{addBlocked ? pmT('Estimates are set on tasks only: pick a task (not a stage) to add positions.') : pmT('Add a position, then select its norm from the norm book.')}</Text>
      </View>
      <ReusableTable
        testID={`${testID}-table`}
        entityName={ESTIMATION_TABLES.line.entity}
        crudListTitle={pmT('Estimate')}
        itemLabel={pmT('Line')}
        localRows={rows}
        onLocalRowsChange={onRows}
        visualColumns={columns}
        selectionEnabled
        onSelectionChange={setSelected}
        // the toolbar of the table (add first / add / duplicate / move / delete) and its row menu work on the POSITIONS; adding is off while a stage is picked (positions belong to a task)
        crudPanelEnabled
        addEnabled={!addBlocked}
        deleteEnabled
        reorderEnabled
        defaultRowJSON={defaultRowJSON}
        readOnly={readOnly}
        contextMenuEnabled
        resizeColumnWidth
        uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', inlineEdit: !readOnly }}
      />
    </View>
  );
}

/** the cost breakdown of a line (zero when unknown) */
function costOf(calc: DocumentCalc, guid: string) {
  return calc.byLine[guid] ?? { labour: 0, machines: 0, operators: 0, materials: 0, other: 0, equipment: 0, direct: 0, payroll: 0, overheads: 0, profit: 0, base: 0, current: 0 };
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 320 },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 8 },
});
