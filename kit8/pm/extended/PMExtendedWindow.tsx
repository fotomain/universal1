// PMExtendedWindow - the "Extended" window of the Gantt bar: one switch (xxxxEnabled) per Extended function, a short description, "more…" for the full one, and the options of the
// functions that are on (calendars, status date, chart options ...). Opened by the "Extended" button of the Gantt bar (visible only while Project settings → Gantt has the master switch on).
// Save writes the switches and ganttExtendedOptions into project_table.rowJSON in one update. documentation/MORE_GANTT_INPUT.html
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import SwitchApp from '../../ui/components/common/SwitchApp';
import IconApp from '../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import TextInputApp from '../../ui/components/common/TextInputApp';
import PMDateInput from '../inner/inputs/PMDateInput';
import { PMDialogButton } from '../inner/buttons';
import { PMCustomColumnDef, projectCustomColumnsOf } from '../view/tree/columns/customColumns';
import { usePMStore } from '../store/store_pm';
import { PMCrud } from '../crud/usePMCrud';
import { pmT } from '../i18n/pmT';
import { extendedMasterOf, extendedOf, PM_EXTENDED_FEATURES, PM_EXTENDED_GROUPS, PMExtendedFeature, extendedPatch } from './extendedModel';
import {
  extendedOptionsOf,
  PM_DEFAULT_WORK_WEEK,
  PMBarTextField,
  PMExtendedOptions,
  PMGanttCalendarDef,
  PMGroupBy,
  PMHighlight,
  PMTimescaleUnit,
} from './extendedOptions';

const COLORS = [
  { value: '', label: 'Default' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#0ea5e9', label: 'Sky' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#64748b', label: 'Slate' },
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UNITS: { value: PMTimescaleUnit; label: string }[] = ['auto', 'year', 'quarter', 'month', 'week', 'day'].map((v) => ({ value: v as PMTimescaleUnit, label: v === 'auto' ? 'Automatic' : v[0].toUpperCase() + v.slice(1) }));
const TEXT_FIELDS: { value: PMBarTextField; label: string }[] = [
  { value: 'none', label: 'Nothing' }, { value: 'start', label: 'Start' }, { value: 'finish', label: 'Finish' },
  { value: 'duration', label: 'Duration' }, { value: 'percent', label: '% complete' }, { value: 'priority', label: 'Priority' },
];
const GROUPS: { value: PMGroupBy; label: string }[] = [
  { value: 'none', label: 'No grouping' }, { value: 'priority', label: 'Priority' }, { value: 'critical', label: 'Critical' },
  { value: 'percent', label: '% complete' }, { value: 'duration', label: 'Duration' }, { value: 'inactive', label: 'Inactive' },
];
const HIGHLIGHTS: { value: PMHighlight; label: string }[] = [
  { value: 'none', label: 'No highlight' }, { value: 'critical', label: 'Critical tasks' }, { value: 'late', label: 'Late tasks' },
  { value: 'milestones', label: 'Milestones' }, { value: 'inProgress', label: 'In progress' }, { value: 'behindBaseline', label: 'Behind the baseline' }, { value: 'highPriority', label: 'Priority above 700' },
];

let calSeq = 0;
const newCalendar = (n: number): PMGanttCalendarDef => ({ id: `cal-${Date.now().toString(36)}-${++calSeq}`, name: `Calendar ${n}`, workWeek: [...PM_DEFAULT_WORK_WEEK], exceptions: [] });

export default function PMExtendedWindow({ crud }: { crud: PMCrud }) {
  const { themeColors: c } = useDesignSystem();
  const open = usePMStore((s) => s.extendedOpen);
  const project = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID] : undefined));
  const win = useWindowDimensions();
  const close = () => usePMStore.getState().setExtendedOpen(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [options, setOptions] = useState<PMExtendedOptions>(() => extendedOptionsOf(undefined));
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [group, setGroup] = useState<string>('scheduling');
  const [calId, setCalId] = useState<string | null>(null);
  // F5: the custom columns of the project with their formula / list (edited here, saved with the rest)
  const [columns, setColumns] = useState<PMCustomColumnDef[]>([]);

  useEffect(() => {
    if (!open || !project) return;
    const cur = extendedOf({ ...project.rowJSON, ganttExtendedFunctionalityEnabled: true });
    setFlags(Object.fromEntries(PM_EXTENDED_FEATURES.map((f) => [f.key, (project.rowJSON as any)[f.key] === true && cur[f.key] !== undefined])));
    setOptions(extendedOptionsOf(project.rowJSON));
    setMore({});
    setCalId(null);
    setColumns(projectCustomColumnsOf(project.rowJSON).columns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.rowGUID]);

  const features = useMemo(() => PM_EXTENDED_FEATURES.filter((f) => f.group === group), [group]);
  if (!open || !project || !extendedMasterOf(project.rowJSON)) return null;

  const cardHeight = Math.max(360, Math.min(680, Math.round(win.height * 0.92)));
  const setOpt = <K extends keyof PMExtendedOptions>(key: K, value: PMExtendedOptions[K]) => setOptions((o) => ({ ...o, [key]: value }));
  const save = () => {
    const cc = projectCustomColumnsOf(project.rowJSON);
    const changed = JSON.stringify(cc.columns) !== JSON.stringify(columns);
    crud.saveProjectJSON({ ...extendedPatch(flags), ganttExtendedOptions: options, ...(changed ? { customColumns: { ...cc, columns } } : {}) });
    close();
  };
  const on = (key: string) => flags[key] === true;
  const requiresOk = (f: PMExtendedFeature) => !f.requires || f.requires.every((k) => on(k));
  const cal = options.calendars.find((x) => x.id === calId) ?? null;
  const setCal = (patch: Partial<PMGanttCalendarDef>) => setOpt('calendars', options.calendars.map((x) => (x.id === calId ? { ...x, ...patch } : x)));

  const labelStyle = { color: c.text };
  const select = <T extends string>(testID: string, label: string, items: { value: T; label: string }[], value: T, onSelect: (v: T) => void) => (
    <View style={styles.opt}>
      <SelectItemFromListApp testID={testID} label={pmT(label)} items={items.map((i) => ({ value: i.value, label: pmT(i.label) }))} value={value} onSelect={onSelect} />
    </View>
  );
  const colorSelect = (testID: string, label: string, value: string | null, onSelect: (v: string | null) => void) =>
    select(testID, label, COLORS, value ?? '', (v) => onSelect(v || null));

  /** the options of a function (only while it is on) */
  const optionsOf = (key: string): React.ReactNode => {
    if (!on(key)) return null;
    switch (key) {
      case 'ganttCalculationModeEnabled':
        return <SwitchApp testID="pm-ext-calculation-manual" label={pmT('Calculation: Manual (press Calculate, F9)')} value={options.calculationManual} onValueChange={(v) => setOpt('calculationManual', v)} style={styles.opt} />;
      case 'ganttManualSchedulingEnabled':
        return <SwitchApp testID="pm-ext-new-manual" label={pmT('New tasks are scheduled manually')} value={options.newTasksManual} onValueChange={(v) => setOpt('newTasksManual', v)} style={styles.opt} />;
      case 'ganttConstraintsEnabled':
        return <SwitchApp testID="pm-ext-honor" label={pmT('Tasks will always honor their constraint dates')} value={options.constraintsAlwaysHonored} onValueChange={(v) => setOpt('constraintsAlwaysHonored', v)} style={styles.opt} />;
      case 'ganttBaselinesEnabled':
        return select('pm-ext-baseline-no', 'Baseline shown on the chart and in the variance columns', Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: i === 0 ? 'Baseline' : `Baseline ${i}` })), String(options.baselineNo), (v) => setOpt('baselineNo', Number(v)));
      case 'ganttStatusDateEnabled':
        return <PMDateInput testID="pm-ext-status-date" label={pmT('Status date (empty = today)')} dateFormat="YYYY-MM-DD" value={options.statusDate ?? ''} onChangeText={(v) => setOpt('statusDate', /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : v ? options.statusDate : null)} style={styles.opt} />;
      case 'ganttTimescaleEnabled':
        return (
          <>
            {select('pm-ext-ts-top', 'Top tier', UNITS, options.timescale.top, (v) => setOpt('timescale', { ...options.timescale, top: v }))}
            {select('pm-ext-ts-bottom', 'Bottom tier', UNITS, options.timescale.bottom, (v) => setOpt('timescale', { ...options.timescale, bottom: v }))}
            {select('pm-ext-ts-labels', 'Labels', [{ value: 'short', label: 'Short' }, { value: 'long', label: 'Long' }], options.timescale.labels, (v) => setOpt('timescale', { ...options.timescale, labels: v }))}
          </>
        );
      case 'ganttBarStylesEnabled':
        return (
          <>
            {colorSelect('pm-ext-bs-normal', 'Normal bar', options.barStyles.normal, (v) => setOpt('barStyles', { ...options.barStyles, normal: v }))}
            {colorSelect('pm-ext-bs-summary', 'Summary bar', options.barStyles.summary, (v) => setOpt('barStyles', { ...options.barStyles, summary: v }))}
            {colorSelect('pm-ext-bs-milestone', 'Milestone', options.barStyles.milestone, (v) => setOpt('barStyles', { ...options.barStyles, milestone: v }))}
            {colorSelect('pm-ext-bs-critical', 'Critical bar', options.barStyles.critical, (v) => setOpt('barStyles', { ...options.barStyles, critical: v }))}
            {colorSelect('pm-ext-bs-manual', 'Manually scheduled bar', options.barStyles.manual, (v) => setOpt('barStyles', { ...options.barStyles, manual: v }))}
            {select('pm-ext-bs-corner', 'Corners', [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }], options.barStyles.corner, (v) => setOpt('barStyles', { ...options.barStyles, corner: v }))}
          </>
        );
      case 'ganttBarTextEnabled':
        return (
          <>
            {select('pm-ext-bt-left', 'Text left of the bar', TEXT_FIELDS, options.barText.left, (v) => setOpt('barText', { ...options.barText, left: v }))}
            {select('pm-ext-bt-right', 'Text right of the bar', TEXT_FIELDS, options.barText.right, (v) => setOpt('barText', { ...options.barText, right: v }))}
          </>
        );
      case 'ganttGridlinesEnabled':
        return (
          <>
            {(['today', 'status', 'projectEdges', 'weeks', 'rows'] as const).map((k) => (
              <SwitchApp key={k} testID={`pm-ext-grid-${k}`} label={pmT({ today: 'Today line', status: 'Status date line', projectEdges: 'Project start and finish lines', weeks: 'Week and month lines', rows: 'Row lines' }[k])} value={options.gridlines[k]} onValueChange={(v) => setOpt('gridlines', { ...options.gridlines, [k]: v })} style={styles.opt} />
            ))}
          </>
        );
      case 'ganttLayoutOptionsEnabled':
        return (
          <>
            {select('pm-ext-bar-height', 'Bar height', [{ value: 'small', label: 'Small' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }], options.layout.barHeight, (v) => setOpt('layout', { ...options.layout, barHeight: v }))}
            <SwitchApp testID="pm-ext-summary-details" label={pmT('Summary bars show the details of their tasks')} value={options.layout.summaryDetails} onValueChange={(v) => setOpt('layout', { ...options.layout, summaryDetails: v })} style={styles.opt} />
          </>
        );
      case 'ganttTextStylesEnabled':
        return (
          <>
            {(['critical', 'summary', 'milestone'] as const).map((k) => (
              <View key={k}>
                <SwitchApp testID={`pm-ext-ts-${k}-bold`} label={pmT({ critical: 'Critical rows: bold', summary: 'Summary rows: bold', milestone: 'Milestones: bold' }[k])} value={options.textStyles[k].bold} onValueChange={(v) => setOpt('textStyles', { ...options.textStyles, [k]: { ...options.textStyles[k], bold: v } })} style={styles.opt} />
                {colorSelect(`pm-ext-ts-${k}-color`, { critical: 'Critical rows: colour', summary: 'Summary rows: colour', milestone: 'Milestones: colour' }[k], options.textStyles[k].color, (v) => setOpt('textStyles', { ...options.textStyles, [k]: { ...options.textStyles[k], color: v } }))}
              </View>
            ))}
          </>
        );
      case 'ganttWbsCodeEnabled':
        return <TextInputApp testID="pm-ext-wbs-mask" label={pmT('Code mask per level, separated by dots: 1 = number, A = letter, 01 = two digits (A.01.001)')} value={options.wbsMask} onChangeText={(v) => setOpt('wbsMask', v)} style={styles.opt} />;
      case 'ganttCustomFieldsEnabled': {
        const setCol = (k: string, patch: Partial<PMCustomColumnDef>) => setColumns((cols) => cols.map((x) => (x.key === k ? { ...x, ...patch } : x)));
        return (
          <View style={styles.opt}>
            <Text style={[styles.optTitle, labelStyle]}>{pmT('Custom columns: a formula (calculated, read only) or a list of values')}</Text>
            {columns.length === 0 && <Text style={[styles.short, labelStyle]}>{pmT('No custom columns yet: add one with the column menu of the task table, then give it a formula here.')}</Text>}
            {columns.map((col) => (
              <View key={col.key} testID={`pm-ext-col-${col.key}`} style={[styles.calBox, { borderColor: c.border }]}>
                <Text style={[styles.calName, labelStyle]}>{col.name}</Text>
                <TextInputApp
                  testID={`pm-ext-col-formula-${col.key}`}
                  label={pmT('Formula, e.g. IF([% Complete]>=100; "Done"; [Finish]-[Start])')}
                  value={col.formula ?? ''}
                  onChangeText={(v) => setCol(col.key, { formula: v.trim() ? v : undefined, ...(v.trim() ? { list: undefined } : {}) })}
                />
                {!col.formula && (
                  <TextInputApp
                    testID={`pm-ext-col-list-${col.key}`}
                    label={pmT('List of values, separated by ;')}
                    value={(col.list ?? []).join('; ')}
                    onChangeText={(v) => setCol(col.key, { list: v.split(';').map((x) => x.trim()).filter(Boolean) })}
                  />
                )}
              </View>
            ))}
          </View>
        );
      }
      case 'ganttGroupByEnabled':
        return select('pm-ext-group-by', 'Group the rows by', GROUPS, options.groupBy, (v) => setOpt('groupBy', v));
      case 'ganttHighlightFilterEnabled':
        return select('pm-ext-highlight', 'Highlight the rows that are', HIGHLIGHTS, options.highlight, (v) => setOpt('highlight', v));
      case 'ganttCalendarExceptionsEnabled':
      case 'ganttTaskCalendarEnabled': {
        if (key === 'ganttTaskCalendarEnabled' && on('ganttCalendarExceptionsEnabled')) return null; // one editor
        return (
          <View style={styles.opt}>
            <Text style={[styles.optTitle, labelStyle]}>{pmT('Calendars')}</Text>
            {options.calendars.map((x) => (
              <Pressable key={x.id} testID={`pm-ext-cal-${x.id}`} onPress={() => setCalId(calId === x.id ? null : x.id)} style={[styles.calRow, { borderColor: c.border, backgroundColor: calId === x.id ? c.surface : 'transparent' }]}>
                <IconApp name="event" size={16} color={c.primary} />
                <Text style={[styles.calName, labelStyle]}>{x.name}{options.projectCalendarId === x.id ? ` · ${pmT('project calendar')}` : ''}</Text>
              </Pressable>
            ))}
            <PMDialogButton testID="pm-ext-cal-add" kind="secondary" title={pmT('Add calendar')} icon="add" onPress={() => { const n = newCalendar(options.calendars.length + 1); setOpt('calendars', [...options.calendars, n]); setCalId(n.id); }} />
            {cal && (
              <View style={[styles.calBox, { borderColor: c.border }]}>
                <TextInputApp testID="pm-ext-cal-name" label={pmT('Name')} value={cal.name} onChangeText={(v) => setCal({ name: v })} />
                <Text style={[styles.optTitle, labelStyle]}>{pmT('Working week')}</Text>
                <View style={styles.weekRow}>
                  {DAYS.map((d, i) => (
                    <Pressable key={d} testID={`pm-ext-cal-day-${i}`} onPress={() => setCal({ workWeek: cal.workWeek.map((w, j) => (j === i ? !w : w)) })} style={[styles.dayChip, { borderColor: c.border, backgroundColor: cal.workWeek[i] ? c.primary : 'transparent' }]}>
                      <Text style={{ color: cal.workWeek[i] ? '#fff' : c.text, fontSize: 12 }}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
                {on('ganttCalendarExceptionsEnabled') && (
                  <>
                    <Text style={[styles.optTitle, labelStyle]}>{pmT('Exceptions (holidays, days off, extra working days)')}</Text>
                    {cal.exceptions.map((e, i) => (
                      <View key={i} style={styles.excRow}>
                        <View style={{ flex: 1 }}><PMDateInput testID={`pm-ext-cal-exc-from-${i}`} label={pmT('From')} value={e.from} dateFormat="YYYY-MM-DD" onChangeText={(v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && setCal({ exceptions: cal.exceptions.map((x, j) => (j === i ? { ...x, from: v, to: x.to < v ? v : x.to } : x)) })} /></View>
                        <View style={{ flex: 1 }}><PMDateInput testID={`pm-ext-cal-exc-to-${i}`} label={pmT('To')} value={e.to} dateFormat="YYYY-MM-DD" onChangeText={(v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && setCal({ exceptions: cal.exceptions.map((x, j) => (j === i ? { ...x, to: v < x.from ? x.from : v } : x)) })} /></View>
                        <Pressable testID={`pm-ext-cal-exc-work-${i}`} onPress={() => setCal({ exceptions: cal.exceptions.map((x, j) => (j === i ? { ...x, working: !x.working } : x)) })} style={[styles.dayChip, { borderColor: c.border }]}><Text style={{ color: c.text, fontSize: 12 }}>{e.working ? pmT('works') : pmT('off')}</Text></Pressable>
                        <Pressable testID={`pm-ext-cal-exc-del-${i}`} onPress={() => setCal({ exceptions: cal.exceptions.filter((_, j) => j !== i) })}><IconApp name="delete" size={18} color={c.error ?? '#dc2626'} /></Pressable>
                      </View>
                    ))}
                    <PMDialogButton testID="pm-ext-cal-exc-add" kind="text" title={pmT('Add exception')} icon="add" onPress={() => { const d = new Date().toISOString().slice(0, 10); setCal({ exceptions: [...cal.exceptions, { from: d, to: d }] }); }} />
                    <SwitchApp testID="pm-ext-cal-project" label={pmT('This is the calendar of the whole project')} value={options.projectCalendarId === cal.id} onValueChange={(v) => setOpt('projectCalendarId', v ? cal.id : null)} style={styles.opt} />
                  </>
                )}
                <PMDialogButton testID="pm-ext-cal-delete" kind="danger" title={pmT('Delete calendar')} icon="delete" onPress={() => { setOpt('calendars', options.calendars.filter((x) => x.id !== cal.id)); if (options.projectCalendarId === cal.id) setOpt('projectCalendarId', null); setCalId(null); }} />
              </View>
            )}
          </View>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View testID="pm-extended-window" style={[styles.card, { backgroundColor: c.background, borderColor: c.border, height: cardHeight }]}>
          <View style={styles.header}>
            <IconApp name="tune" size={20} color={c.primary} />
            <Text style={[styles.title, labelStyle]}>{pmT('Extended Gantt functions')}</Text>
            <View style={{ flex: 1 }} />
            <Pressable testID="pm-extended-close" onPress={close} accessibilityLabel={pmT('Close')}><IconApp name="close" size={20} color={c.text} /></Pressable>
          </View>
          <Text style={[styles.hint, labelStyle]}>{pmT('Every function is off until you switch it on here. With everything off the Gantt chart works as before.')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ gap: 6 }}>
            {PM_EXTENDED_GROUPS.map((g) => {
              const count = PM_EXTENDED_FEATURES.filter((f) => f.group === g.id && on(f.key)).length;
              return (
                <Pressable key={g.id} testID={`pm-extended-tab-${g.id}`} onPress={() => setGroup(g.id)} style={[styles.tab, { borderColor: group === g.id ? c.primary : c.border }]}>
                  <IconApp name={g.icon} size={14} color={group === g.id ? c.primary : c.text} />
                  <Text style={{ color: group === g.id ? c.primary : c.text, fontSize: 13 }}>{pmT(g.title)}{count ? ` · ${count}` : ''}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
            {features.map((f) => (
              <View key={f.key} testID={`pm-ext-feature-${f.id}`} style={[styles.feature, { borderColor: c.border }]}>
                <SwitchApp testID={`pm-ext-${f.key}`} label={`${f.id} · ${pmT(f.title)}`} value={on(f.key) && requiresOk(f)} disabled={!requiresOk(f)} onValueChange={(v) => setFlags((x) => ({ ...x, [f.key]: v }))} />
                <Text style={[styles.short, labelStyle]}>{pmT(f.short)}{!requiresOk(f) ? ` (${pmT('needs')}: ${f.requires!.map((k) => PM_EXTENDED_FEATURES.find((x) => x.key === k)?.title).join(', ')})` : ''}</Text>
                <Pressable testID={`pm-ext-more-${f.id}`} onPress={() => setMore((m) => ({ ...m, [f.key]: !m[f.key] }))}><Text style={{ color: c.primary, fontSize: 12 }}>{more[f.key] ? pmT('less') : pmT('more…')}</Text></Pressable>
                {more[f.key] && <Text style={[styles.more, labelStyle]}>{pmT(f.more)}</Text>}
                {optionsOf(f.key)}
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <View style={{ flex: 1 }} />
            <PMDialogButton testID="pm-extended-cancel" kind="secondary" title={pmT('Cancel')} color={c.text} onPress={close} />
            <PMDialogButton testID="pm-extended-save" kind="primary" title={pmT('Save')} onPress={save} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { width: '100%', maxWidth: 760, borderRadius: 12, borderWidth: 1, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 12, opacity: 0.7, marginBottom: 8 },
  tabs: { flexGrow: 0, marginBottom: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  feature: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10, marginBottom: 8 },
  short: { fontSize: 12, opacity: 0.75, marginTop: 2 },
  more: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  opt: { marginTop: 8 },
  optTitle: { fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 6, padding: 6, marginBottom: 4 },
  calName: { fontSize: 13 },
  calBox: { borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 6 },
  weekRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  dayChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  excRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 8 },
});
