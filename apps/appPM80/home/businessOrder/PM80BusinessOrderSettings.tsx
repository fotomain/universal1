// PM80BusinessOrderSettings - the screen where the user sets up the "Business order" of the PM80 home (route /pm/business-order).
//   ReusableTable in LOCAL ROWS mode: no row is made or deleted, the NAMES are read only; the user ticks "Show" and moves the steps
//   (drag the handle on the web, the move buttons / the row menu elsewhere). A step that is not shown keeps its place in the order.
//   "Defaults" puts the default setup (all steps, the order of the app, all shown) into the table; "Save" writes it (businessOrderModel.ts:
//   one project -> it, some -> each of them, all -> the organization and each project).
//   The look of the home (items in the first row, form of the items = PM80HomeSettingsPanel) is set at the top of this screen too:
//   it applies and is saved at once on this device (there is no separate Home settings button on the home any more).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useDesignSystem } from '../../../../kit8/providers/WithDesignSystem';
import ButtonApp from '../../../../kit8/ui/components/common/ButtonApp';
import ReusableTable from '../../../../kit8/ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow, VisualColumn } from '../../../../kit8/ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../../../../kit8/pm/i18n/pmT';
import { PM80_STAGES, normalizeProjectSelection } from '../pm80HomeModel';
import PM80HomeSettingsPanel from '../homeSettings/PM80HomeSettingsPanel';
import { saveHomeSettingsLocal, useHomeSettings } from '../homeSettings/homeSettingsLocal';
import {
  BusinessOrderSelection,
  BusinessOrderSettings,
  businessOrderEquals,
  businessOrderScopeText,
  businessOrderShownCount,
  defaultBusinessOrder,
  isDefaultBusinessOrder,
  normalizeBusinessOrder,
  reorderBusinessOrder,
  setBusinessOrderVisible,
} from './businessOrderModel';
import { BusinessOrderSaveReport, useBusinessOrderFor, usePM80Projects, useSaveBusinessOrder } from './useBusinessOrder';

const STAGE_BY_ID = new Map(PM80_STAGES.map((s) => [s.id, s]));
const oneLine = (s: string) => s.replace(/\n/g, ' ');

/** the rows of the table for the settings: the user's order, orderInList 1..n */
export function businessOrderRows(settings: BusinessOrderSettings): ReusableTableRow[] {
  return normalizeBusinessOrder(settings).items.map((it, i) => {
    const def = STAGE_BY_ID.get(it.id)!;
    return {
      rowGUID: it.id,
      rowOwnerGUID: 'empty',
      rowParentGUID: 'empty',
      orderInList: i + 1,
      rowJSON: { checked: it.visible, title: oneLine(def.label), stage: def.stage, module: def.genusOrDomain },
    } as ReusableTableRow;
  });
}

/** the settings from the rows the table hands up (a check box, a move) */
export function businessOrderFromRows(rows: ReusableTableRow[], current: BusinessOrderSettings): BusinessOrderSettings {
  const ordered = [...rows].sort((a, b) => (a.orderInList ?? 0) - (b.orderInList ?? 0));
  let next = reorderBusinessOrder(current, ordered.map((r) => r.rowGUID));
  ordered.forEach((r) => {
    next = setBusinessOrderVisible(next, r.rowGUID, r.rowJSON?.checked !== false);
  });
  return next;
}

export interface PM80BusinessOrderSettingsProps {
  /** the project filter of the home: null = ALL projects */
  selection: BusinessOrderSelection;
  testID?: string;
}

export default function PM80BusinessOrderSettings({ selection, testID = 'pm80-business-order' }: PM80BusinessOrderSettingsProps) {
  const { themeColors: c } = useDesignSystem();
  // a phone / a narrow window: two columns (Show, Step) that fit the width, a shorter hint, room under the table for the + button
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const src = usePM80Projects();
  const sel = useMemo(() => normalizeProjectSelection(selection, src.projects), [selection, src.projects]);
  const allIds = useMemo(() => src.projects.map((p) => p.id), [src.projects]);
  const stored = useBusinessOrderFor(sel, src.rows);
  const save = useSaveBusinessOrder(src.rows, src.ownerGUID, allIds);
  const homeSettings = useHomeSettings();

  const [draft, setDraft] = useState<BusinessOrderSettings>(stored);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<BusinessOrderSaveReport | null>(null);
  // the draft follows what is stored until the user touches it (the stored setup arrives after the screen opened)
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) setDraft(stored);
  }, [stored]);

  const changed = !businessOrderEquals(draft, stored);
  const shown = businessOrderShownCount(draft);
  const rows = useMemo(() => businessOrderRows(draft), [draft]);

  const columns = useMemo<VisualColumn[]>(() => {
    if (compact) {
      // the service columns (select, drag ⠿, row menu) take about 160 px, the rest is the two columns
      const stepWidth = Math.max(130, width - 160 - 72);
      return [
        { key: 'checked', title: pmT('Show'), type: 'boolean', width: 72, align: 'center' },
        { key: 'title', title: pmT('Step'), type: 'text', editable: false, width: stepWidth },
      ];
    }
    return [
      { key: 'checked', title: pmT('Show'), type: 'boolean', width: 90, align: 'center' },
      { key: 'title', title: pmT('Step'), type: 'text', editable: false, width: 190 },
      { key: 'stage', title: pmT('Phase'), type: 'text', editable: false, width: 110 },
      { key: 'module', title: pmT('What it is'), type: 'text', editable: false, width: 240 },
    ];
  }, [compact, width]);

  const onRows = useCallback(
    (next: ReusableTableRow[]) => {
      touched.current = true;
      setReport(null);
      setDraft((cur) => businessOrderFromRows(next, cur));
    },
    []
  );

  const onDefaults = () => {
    touched.current = true;
    setReport(null);
    setDraft(defaultBusinessOrder());
  };

  const onSave = async () => {
    if (shown === 0 || saving) return;
    setSaving(true);
    try {
      setReport(await save(draft, sel));
      touched.current = false; // the stored setup is what the screen shows again
    } finally {
      setSaving(false);
    }
  };

  const oneName = sel && sel.length === 1 ? src.projects.find((p) => p.id === sel[0])?.name : undefined;
  const scopeText = businessOrderScopeText(sel, src.projects.length, oneName);

  return (
    <View testID={testID} style={styles.root}>
      <View style={styles.head}>
        <PM80HomeSettingsPanel
          testID={`${testID}-home-settings`}
          settings={homeSettings}
          onChange={saveHomeSettingsLocal}
          textStrong={c.text}
          textMuted={c.text}
          accent={c.primary}
          borderColor={c.border}
        />
        <Text testID={`${testID}-scope`} style={[styles.scope, { color: c.text }]}>
          {pmT(scopeText)}
        </Text>
        <Text style={[styles.hint, { color: c.text }]}>
          {compact
            ? pmT('Tick the steps to show; drag ⠿ to move a step. A hidden step keeps its place.')
            : pmT('Tick the steps to show and move them into the order you want. The names cannot be changed. A step that is not shown keeps its place in your order.')}
        </Text>
        <View style={styles.bar}>
          <ButtonApp
            testID={`${testID}-defaults`}
            title={pmT('Defaults')}
            icon="restart_alt"
            variant="outlined"
            size="small"
            disabled={isDefaultBusinessOrder(draft)}
            onPress={onDefaults}
          />
          <ButtonApp
            testID={`${testID}-save`}
            title={saving ? pmT('Saving...') : pmT('Save')}
            icon="save"
            variant="contained"
            size="small"
            disabled={!changed || shown === 0 || saving}
            onPress={onSave}
          />
          <Text testID={`${testID}-count`} style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>
            {pmT('{{n}} of {{total}} steps are shown', { n: shown, total: draft.items.length })}
          </Text>
          {changed && !report && (
            <Text testID={`${testID}-unsaved`} style={{ color: c.primary, fontSize: 12, fontWeight: '700' }}>
              {pmT('Not saved yet')}
            </Text>
          )}
        </View>
        {shown === 0 && (
          <Text testID={`${testID}-none`} style={{ color: c.error, fontSize: 12 }}>
            {pmT('No step is shown. Tick at least one step.')}
          </Text>
        )}
        {report && (
          <Text
            testID={`${testID}-message`}
            style={{ color: report.failures.length ? c.error : c.primary, fontSize: 12, fontWeight: '600' }}
          >
            {reportText(report)}
          </Text>
        )}
      </View>
      <ReusableTable
        testID={`${testID}-table`}
        entityName="pm80BusinessOrder"
        crudListTitle={pmT('Business order')}
        itemLabel={pmT('Step')}
        localRows={rows}
        onLocalRowsChange={onRows}
        visualColumns={columns}
        addEnabled={false}
        deleteEnabled={false}
        reorderEnabled
        searchEnabled={false}
        columnSortAndFilter={false}
      />
      {/* the + button of the app floats over the bottom right corner: keep the last row clear of it */}
      {compact && <View style={styles.fabSpace} />}
    </View>
  );
}

/** what happened to a save, in words */
export function reportText(r: BusinessOrderSaveReport): string {
  const parts: string[] = [];
  if (r.savedOrganization) parts.push(pmT('saved in the organization'));
  if (r.savedProjects.length) parts.push(pmT('saved in {{n}} project(s)', { n: r.savedProjects.length }));
  if (r.localOnly.length) parts.push(pmT('kept on this device for {{n}} place(s) (sign in as the owner to save them)', { n: r.localOnly.length }));
  const head = parts.length ? parts.join('; ') : pmT('nothing was saved');
  const err = r.failures.length ? ` ${pmT('Refused')}: ${r.failures.map((f) => f.error).filter((v, i, a) => a.indexOf(v) === i).join(' / ')}` : '';
  return `${head}.${err}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 8 },
  head: { paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  scope: { fontSize: 14, fontWeight: '800' },
  hint: { fontSize: 12, opacity: 0.75 },
  bar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  fabSpace: { height: 76 },
});
