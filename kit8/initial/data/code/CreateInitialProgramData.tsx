// CreateInitialProgramData - "Create initial data" (Drawer: System settings; and the first run of the application). documentation/INITIAL_DATA_WBS.html
//   LIST mode   a ReusableTable (local rows) of the groups of the initial data with a CHECK BOX near each, what the file has / what the database has / the status; buttons Close and Create.
//               EVERY line has a free check box (2026-11-26): the user selects what to create. By default the groups with something missing are ticked, a complete group is not;
//               a missing required group left unticked is named under the lead text.
//   AUTO mode   the whole data does not exist (a new database): the screen runs by itself, WITHOUT asking, and shows only the progress (Q2 of the owner).
//   When the run has made the rate of 31 December (group rates), the separate window ExchangeRatesWindow is offered before onFinished is called.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { GroupEvaluation } from './initialDataModel';
import { InitialDataController, useInitialData } from './useInitialData';
import ExchangeRatesWindow from './rates/ExchangeRatesWindow';

export interface CreateInitialProgramDataProps {
  /** the state of the gate; without it the screen keeps its own (the menu route) */
  controller?: InitialDataController;
  /** the first run: Close stays disabled until every required group is there */
  locked?: boolean;
  /** run by itself and show only the progress */
  auto?: boolean;
  onClose?: () => void;
  /** called when the run is over (and the rates window, if it was offered, is closed); ok = every required group is there */
  onFinished?: (ok: boolean) => void;
  /** the first run only: after a failed run of the rates the user may go on without them */
  onContinueWithout?: () => void;
  /** the button Skip (before Create): leave WITHOUT creating anything, also on the first run (the gate then lets the user in; it asks again at the next start); default = onClose */
  onSkip?: () => void;
  testID?: string;
}

const STATE_TITLE = { missing: 'Missing', partly: 'Partly', complete: 'Complete' } as const;

const BLOCK_TEXT = {
  noRight: 'The initial data is missing. Only an administrator of the organization can create it: ask your administrator, then open the application again.',
  needsApplicationAdmin: 'The permission matrix, the RACI items and the languages can only be created by an application administrator. The first user of a new database becomes one by himself; here another user has to do it (an administrator adds the e-mail in SQL).',
} as const;

export function groupRows(ev: GroupEvaluation[], checkedIds: string[]): ReusableTableRow[] {
  return ev.map((g, i) => ({
    rowGUID: g.id,
    rowParentGUID: 'empty',
    orderInList: (i + 1) * 10,
    rowJSON: {
      checked: checkedIds.includes(g.id),
      title: g.title,
      requiredTitle: g.tier === 'A' ? 'Required' : 'Optional',
      inFile: g.rowsInFile,
      inDatabase: g.found,
      statusTitle: g.requiredOk && g.state !== 'complete' ? `${STATE_TITLE[g.state]} (enough to work)` : STATE_TITLE[g.state],
      note: g.note ?? '',
    },
  }));
}

export default function CreateInitialProgramData({ controller, locked = false, auto = false, onClose, onFinished, onContinueWithout, onSkip, testID = 'initial-data' }: CreateInitialProgramDataProps) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const own = useInitialData({ supabase, autoCheck: !controller });
  const ctl = controller ?? own;
  const { phase, evaluation, decision, progress, error, failedGroup, checkedIds } = ctl;
  const [ratesOpen, setRatesOpen] = useState(false);
  const started = useRef(false);
  const finishedRef = useRef(false);

  // AUTO mode: nothing exists - run by itself, once
  useEffect(() => {
    if (!auto || started.current || phase !== 'needs' || decision?.kind !== 'auto') return;
    started.current = true;
    void ctl.run(decision.groups);
  }, [auto, phase, decision, ctl]);

  // the run is over: offer the rates window when the run made the rate of 31 December, then tell the caller
  useEffect(() => {
    if (phase !== 'done' || finishedRef.current) return;
    if (ctl.result?.rates) setRatesOpen(true);
    else { finishedRef.current = true; onFinished?.(true); }
  }, [phase, ctl.result, onFinished]);
  const closeRates = useCallback(() => {
    setRatesOpen(false);
    if (!finishedRef.current) { finishedRef.current = true; onFinished?.(true); }
  }, [onFinished]);

  const requiredMissing = evaluation.some((g) => g.tier === 'A' && !g.requiredOk);
  const running = phase === 'running';
  const rows = useMemo(() => groupRows(evaluation, checkedIds), [evaluation, checkedIds]);
  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'checked', title: 'Create', type: 'boolean', width: 90, align: 'center' },
    { key: 'title', title: 'Initial data', type: 'text', editable: false, width: 330 },
    { key: 'requiredTitle', title: 'Required', type: 'text', editable: false, width: 100 },
    { key: 'inFile', title: 'In the file', type: 'number', editable: false, width: 100 },
    { key: 'inDatabase', title: 'In the database', type: 'number', editable: false, width: 130 },
    { key: 'statusTitle', title: 'Status', type: 'text', editable: false, width: 200 },
    // the note is a warning (something is missing): red
    { key: 'note', title: 'Note', type: 'custom', width: 320, searchText: (r) => String(r.rowJSON?.note ?? ''),
      renderCell: (r) => <Text testID={`${testID}-note-${r.rowGUID}`} style={{ color: c.error, paddingHorizontal: 8 }}>{String(r.rowJSON?.note ?? '')}</Text> },
  ], [c.error, testID]);
  // a check box in the table -> the ids to create; EVERY line is free (the user decides what to create)
  const onRows = useCallback((next: ReusableTableRow[]) => {
    const wanted = new Set(next.filter((r) => r.rowJSON?.checked === true).map((r) => r.rowGUID));
    ctl.setCheckedIds(evaluation.filter((g) => wanted.has(g.id)).map((g) => g.id));
  }, [ctl, evaluation]);
  // a required group the user left unticked while it is still missing: said in words (the application will not work without it)
  const requiredLeftOut = evaluation.filter((g) => g.tier === 'A' && !g.requiredOk && !checkedIds.includes(g.id));

  const create = useCallback(() => { finishedRef.current = false; void ctl.run(); }, [ctl]);
  const closeDisabled = running || (locked && requiredMissing);
  // progress only: while Create writes, and in AUTO mode from the first check until the run is over (a failure shows the list with the message)
  const progressOnly = running || (auto && (phase === 'idle' || phase === 'checking' || (phase === 'needs' && decision?.kind === 'auto')));

  // ---------------------------------------------------------------- progress only (a new database, or while Create writes)
  if (progressOnly) {
    const pct = Math.round((progress?.fraction ?? 0) * 100);
    return (
      <View testID={`${testID}-progress`} style={[styles.progressRoot, { backgroundColor: c.background }]}>
        <Text style={[styles.title, { color: c.text }]}>Preparing the application</Text>
        <Text style={{ color: c.text, opacity: 0.7, textAlign: 'center' }}>The initial data of a new database is being created. Please wait: this happens once.</Text>
        <View style={[styles.barOuter, { borderColor: c.border }]}>
          <View testID={`${testID}-bar`} style={[styles.barInner, { width: `${pct}%`, backgroundColor: c.primary }]} />
        </View>
        <Text testID={`${testID}-percent`} style={{ color: c.text, fontWeight: '600' }}>{progress ? `${pct} %` : 'Checking the data…'}</Text>
        {progress && <Text testID={`${testID}-step`} style={{ color: c.text }}>{`Step ${progress.groupNumber} of ${progress.groupCount}: ${progress.groupTitle}`}</Text>}
        {progress?.table && progress.total > 0 && <Text style={{ color: c.text, opacity: 0.7 }}>{`${progress.table}: ${progress.done} / ${progress.total}`}</Text>}
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  // ---------------------------------------------------------------- a failed run in AUTO mode: the message and what to do
  const failedBar = phase === 'failed' && (
    <View testID={`${testID}-failed`} style={[styles.message, { borderColor: c.error }]}>
      <Text style={{ color: c.error, fontWeight: '600' }}>{failedGroup ? `The step "${evaluation.find((g) => g.id === failedGroup)?.title ?? failedGroup}" stopped.` : 'The initial data could not be created.'}</Text>
      {error && <Text style={{ color: c.error }}>{error}</Text>}
      <Text style={{ color: c.text, opacity: 0.7 }}>What was written stays; trying again goes on from there.</Text>
    </View>
  );

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Text style={[styles.title, { color: c.text, paddingHorizontal: 12 }]}>Create initial data</Text>
        <Text style={[styles.lead, { color: c.text }]}>
          What the application needs before it can work: the permission matrix, the genus and budget items, the calendars, currencies and more. Tick what to create; only what the database does not have yet is written, and
          nothing that exists is changed.
        </Text>
        {phase === 'checking' && <ActivityIndicator style={{ margin: 16 }} color={c.primary} />}
        {phase === 'blocked' && decision?.kind === 'blocked' && <Text testID={`${testID}-blocked`} style={[styles.message, { color: c.error, borderColor: c.error }]}>{BLOCK_TEXT[decision.reason]}</Text>}
        {failedBar}
        {requiredLeftOut.length > 0 && !running && (
          <Text testID={`${testID}-required-left-out`} style={[styles.message, { color: c.text, borderColor: c.border }]}>
            {`Not ticked, but the application needs it: ${requiredLeftOut.map((g) => g.title).join('; ')}.`}
          </Text>
        )}
        {phase === 'done' && <Text testID={`${testID}-done`} style={[styles.message, { color: c.text, borderColor: c.border }]}>The initial data is ready.</Text>}
        {evaluation.length > 0 && (
          <View style={styles.tableBox}>
            <ReusableTable
              testID={`${testID}-table`}
              entityName="initialDataGroups"
              crudListTitle="Initial data"
              itemLabel="Group"
              localRows={rows}
              onLocalRowsChange={onRows}
              visualColumns={columns}
              selectionEnabled={false}
              crudPanelEnabled={false}
              addEnabled={false}
              deleteEnabled={false}
              reorderEnabled={false}
              contextMenuEnabled={false}
            />
          </View>
        )}
      </ScrollView>
      <View style={styles.buttons}>
        <ButtonApp testID={`${testID}-rates`} title="Exchange rates" icon="currency_exchange" variant="text" disabled={running || phase === 'checking'} onPress={() => setRatesOpen(true)} />
        <View style={{ flex: 1 }} />
        {phase === 'blocked' && <ButtonApp testID={`${testID}-recheck`} title="Check again" icon="refresh" variant="outlined" onPress={() => { void ctl.check(); }} />}
        {failedGroup === 'rates' && onContinueWithout && <ButtonApp testID={`${testID}-continue`} title="Continue without rates" variant="outlined" onPress={onContinueWithout} />}
        <ButtonApp testID={`${testID}-close`} title="Close" variant="outlined" disabled={closeDisabled} onPress={() => onClose?.()} />
        <ButtonApp testID={`${testID}-skip`} title="Skip" variant="outlined" disabled={running || phase === 'checking'} onPress={() => (onSkip ?? onClose)?.()} />
        <ButtonApp testID={`${testID}-create`} title={phase === 'failed' ? 'Create again' : 'Create'} variant="contained" disabled={running || phase === 'checking' || phase === 'blocked' || checkedIds.length === 0} onPress={create} />
      </View>
      <ExchangeRatesWindow visible={ratesOpen} supabase={supabase} onClose={closeRates} testID={`${testID}-rates-window`} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', paddingTop: 12 },
  lead: { fontSize: 13, opacity: 0.8, paddingHorizontal: 12, paddingVertical: 8 },
  message: { borderWidth: 1, borderRadius: 8, padding: 10, marginHorizontal: 12, marginBottom: 8, gap: 4 },
  tableBox: { minHeight: 360, flex: 1 },
  barOuter: { width: '100%', maxWidth: 460, height: 14, borderWidth: 1, borderRadius: 7, overflow: 'hidden' },
  barInner: { height: '100%' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
});
