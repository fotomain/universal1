// The small dialogs of the Gantt Extended functions (kit8/pm/extended), opened through store.extDialog:
//   find          F7  find text in the names / notes, replace it, go to a row number or a date
//   editChecked   F3  change duration / % / priority of all checked rows at once
//   recurring     A13 insert a recurring task: a stage with one task for each occurrence
//   print         H1  the options of "Export to PDF" (every option is off / empty by default)
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import SwitchApp from '../../ui/components/common/SwitchApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import TextInputApp from '../../ui/components/common/TextInputApp';
import PMDateInput from '../inner/inputs/PMDateInput';
import { PMDialogButton } from '../inner/buttons';
import IconApp from '../../ui/components/common/IconApp';
import { usePMStore } from '../store/store_pm';
import type { PMCrud } from '../crud/usePMCrud';
import { pmT } from '../i18n/pmT';
import { exportProjectDashboardToPdf } from '../crud/exchange/pdf/exportDashboardToPdf';
import { PMRecurrenceKind } from './recurrence';

const todayIso = () => new Date().toISOString().slice(0, 10);
const isoMs = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T00:00:00Z`) : NaN);

function Frame({ testID, title, onClose, children, actions }: { testID: string; title: string; onClose: () => void; children: React.ReactNode; actions: React.ReactNode }) {
  const { themeColors: c } = useDesignSystem();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View testID={testID} style={[styles.card, { backgroundColor: c.background, borderColor: c.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>{pmT(title)}</Text>
            <View style={{ flex: 1 }} />
            <Pressable testID={`${testID}-close`} onPress={onClose} accessibilityLabel={pmT('Close')}><IconApp name="close" size={20} color={c.text} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          <View style={styles.actions}>{actions}</View>
        </View>
      </View>
    </Modal>
  );
}

function FindDialog({ crud, close }: { crud: PMCrud; close: () => void }) {
  const { themeColors: c } = useDesignSystem();
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [goto, setGoto] = useState('');
  const [msg, setMsg] = useState('');
  const idx = useRef(-1);
  const findNext = () => {
    const rows = crud.findRows(find);
    if (!rows.length) { setMsg(pmT('Nothing found.')); return; }
    idx.current = (idx.current + 1) % rows.length;
    const g = rows[idx.current];
    const s = usePMStore.getState();
    // a match inside a collapsed stage: open the stage
    const parents: string[] = [];
    for (let p = s.tree.parentById[g]; p; p = s.tree.parentById[p]) parents.push(p);
    if (parents.length) s.expandRows(parents);
    s.setSelected(g);
    s.requestFocus(g);
    setMsg(`${idx.current + 1} / ${rows.length}`);
  };
  const goTo = () => {
    const t = goto.trim();
    const s = usePMStore.getState();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const ms = isoMs(t);
      s.setGanttPeriod({ startMs: ms - 7 * 86400000, finishMs: ms + 21 * 86400000 });
      setMsg(`${pmT('Chart moved to')} ${t}`);
      return;
    }
    const guid = Object.entries(s.tree.wbsById).find(([, w]) => w === t)?.[0];
    if (!guid) { setMsg(pmT('No such row number.')); return; }
    const parents: string[] = [];
    for (let p = s.tree.parentById[guid]; p; p = s.tree.parentById[p]) parents.push(p);
    if (parents.length) s.expandRows(parents);
    s.setSelected(guid);
    s.requestFocus(guid);
    setMsg(s.tasksById[guid]?.rowJSON.taskDescription ?? '');
  };
  return (
    <Frame testID="pm-ext-find" title="Find, replace, go to" onClose={close} actions={<><PMDialogButton testID="pm-ext-find-close" kind="secondary" title={pmT('Close')} color={c.text} onPress={close} /></>}>
      <TextInputApp testID="pm-ext-find-text" label={pmT('Find (name or notes)')} value={find} onChangeText={(v) => { setFind(v); idx.current = -1; }} />
      <TextInputApp testID="pm-ext-replace-text" label={pmT('Replace with (in the names)')} value={replace} onChangeText={setReplace} />
      <View style={styles.row}>
        <PMDialogButton testID="pm-ext-find-next" kind="primary" icon="search" title={pmT('Find next')} disabled={!find.trim()} onPress={findNext} />
        <PMDialogButton testID="pm-ext-replace-all" kind="secondary" icon="find_replace" title={pmT('Replace all')} disabled={!find.trim()} onPress={() => setMsg(`${crud.replaceInNames(find, replace)} ${pmT('name(s) changed')}`)} />
      </View>
      <TextInputApp testID="pm-ext-goto-text" label={pmT('Go to a row number (1.2.3) or a date (YYYY-MM-DD)')} value={goto} onChangeText={setGoto} />
      <PMDialogButton testID="pm-ext-goto" kind="secondary" icon="my_location" title={pmT('Go to')} disabled={!goto.trim()} onPress={goTo} />
      {!!msg && <Text style={{ color: c.text, marginTop: 8 }}>{msg}</Text>}
    </Frame>
  );
}

function EditCheckedDialog({ crud, close }: { crud: PMCrud; close: () => void }) {
  const { themeColors: c } = useDesignSystem();
  const [field, setField] = useState<'duration' | 'percent' | 'priority'>('duration');
  const [value, setValue] = useState('');
  const n = usePMStore((s) => Object.keys(s.checkedGUIDs).length);
  return (
    <Frame testID="pm-ext-edit-checked" title="Edit the checked tasks" onClose={close} actions={<><PMDialogButton testID="pm-ext-edit-cancel" kind="secondary" title={pmT('Cancel')} color={c.text} onPress={close} /><PMDialogButton testID="pm-ext-edit-apply" kind="primary" title={pmT('Apply')} disabled={!value.trim() || !n} onPress={() => { crud.editChecked(field, Number(value.replace(',', '.'))); close(); }} /></>}>
      <Text style={{ color: c.text, marginBottom: 6 }}>{pmT('{{n}} row(s) are checked.', { n })}</Text>
      <SelectItemFromListApp testID="pm-ext-edit-field" label={pmT('Field')} items={[{ value: 'duration', label: pmT('Duration (days)') }, { value: 'percent', label: pmT('% complete') }, { value: 'priority', label: pmT('Priority (0-1000)') }]} value={field} onSelect={(v) => setField(v as typeof field)} />
      <TextInputApp testID="pm-ext-edit-value" label={pmT('New value')} keyboardType="numeric" value={value} onChangeText={setValue} />
    </Frame>
  );
}

function RecurringDialog({ crud, close }: { crud: PMCrud; close: () => void }) {
  const { themeColors: c } = useDesignSystem();
  const [name, setName] = useState('');
  const [days, setDays] = useState('1');
  const [kind, setKind] = useState<PMRecurrenceKind>('weekly');
  const [interval, setInterval] = useState('1');
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [dom, setDom] = useState('1');
  const [from, setFrom] = useState(todayIso());
  const [until, setUntil] = useState('');
  const [count, setCount] = useState('10');
  const [workingOnly, setWorkingOnly] = useState(true);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const create = () => {
    const made = crud.createRecurring({
      name: name.trim() || pmT('Recurring task'),
      durationDays: Math.max(1, Math.round(Number(days) || 1)),
      pattern: { kind, interval: Math.max(1, Math.round(Number(interval) || 1)), from: isoMs(from), until: until ? isoMs(until) : null, count: !until ? Math.max(1, Math.round(Number(count) || 1)) : null, weekdays, dayOfMonth: Math.round(Number(dom) || 1), workingDaysOnly: workingOnly },
    });
    if (made) close();
  };
  return (
    <Frame testID="pm-ext-recurring" title="Insert a recurring task" onClose={close} actions={<><PMDialogButton testID="pm-ext-rec-cancel" kind="secondary" title={pmT('Cancel')} color={c.text} onPress={close} /><PMDialogButton testID="pm-ext-rec-create" kind="primary" title={pmT('Create')} disabled={!Number.isFinite(isoMs(from))} onPress={create} /></>}>
      <TextInputApp testID="pm-ext-rec-name" label={pmT('Name')} value={name} onChangeText={setName} />
      <TextInputApp testID="pm-ext-rec-days" label={pmT('Duration of each task (days)')} keyboardType="numeric" value={days} onChangeText={setDays} />
      <SelectItemFromListApp testID="pm-ext-rec-kind" label={pmT('Repeats')} items={[{ value: 'daily', label: pmT('Daily') }, { value: 'weekly', label: pmT('Weekly') }, { value: 'monthly', label: pmT('Monthly') }, { value: 'yearly', label: pmT('Yearly') }]} value={kind} onSelect={(v) => setKind(v as PMRecurrenceKind)} />
      <TextInputApp testID="pm-ext-rec-interval" label={pmT('Every (n)')} keyboardType="numeric" value={interval} onChangeText={setInterval} />
      {kind === 'weekly' && (
        <View style={styles.row}>
          {DAYS.map((d, i) => (
            <Pressable key={d} testID={`pm-ext-rec-day-${i}`} onPress={() => setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]))} style={[styles.chip, { borderColor: c.border, backgroundColor: weekdays.includes(i) ? c.primary : 'transparent' }]}>
              <Text style={{ color: weekdays.includes(i) ? '#fff' : c.text, fontSize: 12 }}>{d}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {kind === 'monthly' && <TextInputApp testID="pm-ext-rec-dom" label={pmT('Day of the month')} keyboardType="numeric" value={dom} onChangeText={setDom} />}
      {kind === 'daily' && <SwitchApp testID="pm-ext-rec-working" label={pmT('Working days only (Mon-Fri)')} value={workingOnly} onValueChange={setWorkingOnly} />}
      <PMDateInput testID="pm-ext-rec-from" label={pmT('First day')} dateFormat="YYYY-MM-DD" value={from} onChangeText={setFrom} />
      <PMDateInput testID="pm-ext-rec-until" label={pmT('Last day (empty = use the number of occurrences)')} dateFormat="YYYY-MM-DD" value={until} onChangeText={setUntil} />
      {!until && <TextInputApp testID="pm-ext-rec-count" label={pmT('Number of occurrences (max 200)')} keyboardType="numeric" value={count} onChangeText={setCount} />}
    </Frame>
  );
}

/** the legend line of the print options */
function legendText(flags: Record<string, boolean>): string {
  const parts = ['Legend: blue bar = task', 'diamond = milestone', 'dark bar = stage', 'red = critical path'];
  if (flags.ganttManualSchedulingEnabled) parts.push('outlined bar = manually scheduled');
  if (flags.ganttTrackingBarsEnabled) parts.push('grey strip = baseline');
  if (flags.ganttActualDatesEnabled) parts.push('teal strip = actual');
  if (flags.ganttDeadlineEnabled) parts.push('triangle = deadline');
  return parts.join(' · ');
}

function PrintDialog({ close }: { close: () => void }) {
  const { themeColors: c } = useDesignSystem();
  const projectGUID = usePMStore((s) => s.selectedProjectGUID);
  const flags = usePMStore((s) => s.extFlags);
  // every option is off / empty by default
  const [title, setTitle] = useState('');
  const [footer, setFooter] = useState('');
  const [legend, setLegend] = useState(false);
  const [orientation, setOrientation] = useState<'auto' | 'landscape' | 'portrait'>('auto');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    close();
    try {
      const a = from ? isoMs(from) : NaN;
      const b = to ? isoMs(to) : NaN;
      await exportProjectDashboardToPdf(projectGUID, {
        delayMs: 350,
        orientation,
        headerTitle: title.trim() || undefined,
        footer: footer.trim() || undefined,
        legend: legend ? legendText(flags) : undefined,
        period: Number.isFinite(a) && Number.isFinite(b) && b >= a ? { startMs: a, finishMs: b + 86400000 } : null,
      });
    } catch (e: any) {
      usePMStore.getState().setError(e?.message || pmT('PDF export failed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame testID="pm-ext-print" title="Print options" onClose={close} actions={<><PMDialogButton testID="pm-ext-print-cancel" kind="secondary" title={pmT('Cancel')} color={c.text} onPress={close} /><PMDialogButton testID="pm-ext-print-export" kind="primary" icon="picture_as_pdf" title={pmT('Export to PDF')} loading={busy} onPress={run} /></>}>
      <Text style={{ color: c.text, fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{pmT('Every option is off until you choose it: with nothing chosen the export is the same as before.')}</Text>
      <TextInputApp testID="pm-ext-print-title" label={pmT('Header text (instead of the project name)')} value={title} onChangeText={setTitle} />
      <TextInputApp testID="pm-ext-print-footer" label={pmT('Footer text')} value={footer} onChangeText={setFooter} />
      <SwitchApp testID="pm-ext-print-legend" label={pmT('Legend line under the chart')} value={legend} onValueChange={setLegend} />
      <SelectItemFromListApp testID="pm-ext-print-orientation" label={pmT('Page orientation')} items={[{ value: 'auto', label: pmT('By the picture') }, { value: 'landscape', label: pmT('Landscape') }, { value: 'portrait', label: pmT('Portrait') }]} value={orientation} onSelect={(v) => setOrientation(v as typeof orientation)} />
      <PMDateInput testID="pm-ext-print-from" label={pmT('Print from (empty = the chart as shown)')} dateFormat="YYYY-MM-DD" value={from} onChangeText={setFrom} />
      <PMDateInput testID="pm-ext-print-to" label={pmT('Print until')} dateFormat="YYYY-MM-DD" value={to} onChangeText={setTo} />
    </Frame>
  );
}

export default function PMExtendedDialogs({ crud }: { crud: PMCrud }) {
  const dialog = usePMStore((s) => s.extDialog);
  const close = () => usePMStore.getState().setExtDialog(null);
  useEffect(() => () => usePMStore.getState().setExtDialog(null), []);
  if (!dialog) return null;
  if (dialog === 'find') return <FindDialog crud={crud} close={close} />;
  if (dialog === 'editChecked') return <EditCheckedDialog crud={crud} close={close} />;
  if (dialog === 'recurring') return <RecurringDialog crud={crud} close={close} />;
  return <PrintDialog close={close} />;
}


const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { width: '100%', maxWidth: 520, borderRadius: 12, borderWidth: 1, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 6 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', paddingTop: 10 },
});
