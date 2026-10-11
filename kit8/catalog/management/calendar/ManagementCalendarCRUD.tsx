// ManagementCalendarCRUD - the working calendars of the business.
//   top     the calendars: FOLDERS (level 1, the tree: FolderTreeReusable) Project · Resource role · Person and CALENDARS (level 2, the rows of the table)
//   bottom  the DAYS of the selected calendar and year (managementCalendarDaysTable): "Active" off = the day is EXCLUDED (the task plans skip it)
//   header  Fill ▸ current / previous / next year ▸ working days · 5 days · 6 days · all days (CalendarFillMenu)
// The business-level setup of the abstract entity: the owner of every calendar is 'managementCalendarCatalog' until a business table exists.
// `noCrud` (default FALSE): true = read-only. The days table has no add / delete: its rows are made by Fill; the user switches a day on / off.
// Route: /catalog/management/calendar/list · SQL: kit8/sql/init/create_management_calendar_tables.sql
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../../pm/store/store_pm';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { TREE_ALL_ID } from '../../../ui/components/tree/folderTreeModel';
import CalendarFillMenu from './CalendarFillMenu';
import { calendarFolders, calendarPath, calendarsOf, isCalendarFolder, MANAGEMENT_CALENDAR_DAYS_TABLE, MANAGEMENT_CALENDAR_TABLE } from './managementCalendarModel';
import { useManagementCalendarData } from './useManagementCalendarData';
import { useManagementCalendarTree } from './useManagementCalendarTree';

export interface ManagementCalendarCRUDProps {
  /** false (default): full CRUD, true: read-only catalog */
  noCrud?: boolean;
  /** today's year (a test passes a fixed one) */
  currentYear?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REASON_OPTIONS = [
  { value: 'fill', label: 'Fill' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'manual', label: 'Manual' },
];

export default function ManagementCalendarCRUD({ noCrud: noCrudProp = false, currentYear = new Date().getFullYear() }: ManagementCalendarCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const dispatch = useDispatch();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const [noCrud, setNoCrud] = useState(noCrudProp);
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);
  const [selected, setSelected] = useState<string | null>(null);
  const [year, setYear] = useState<number>(currentYear);
  const { rows, loaded, error, reload } = useManagementCalendarData(true);
  const { foldersTree } = useManagementCalendarTree(rows, !noCrud, reload);
  const def = MANAGEMENT_CALENDAR_TABLE;

  const folders = useMemo(() => calendarFolders(rows), [rows]);
  const calendars = useMemo(() => calendarsOf(rows), [rows]);
  const calendarsOnly = useMemo(() => (row: ReusableTableRow) => !isCalendarFolder(row as any), []);
  // the calendar shown below: the one picked, else the first
  const current = calendars.find((r) => r.rowGUID === selected) ?? calendars[0] ?? null;
  const newRowDefaults = useMemo(() => () => ({
    rowOwnerGUID: def.catalogOwner as string,
    rowParentGUID: folders.some((f) => f.rowGUID === folder) ? folder : folders[0]?.rowGUID,
    rowJSON: {},
  }), [def.catalogOwner, folders, folder]);

  const columns = useMemo<VisualColumn[]>(() => {
    const folderOptions = folders.map((f) => ({ value: f.rowGUID, label: calendarPath(rows, f.rowGUID) }));
    const cols: VisualColumn[] = [
      { key: 'n', title: '#', type: 'rowNumber' },
      { key: 'title', title: 'Calendar', type: 'text', width: 240 },
      { key: 'code', title: 'Code', type: 'custom', width: 200, editable: false, renderCell: (row) => <Text numberOfLines={1} style={{ color: c.text, opacity: 0.75, fontSize: 13 }}>{row.rowGUID}</Text>, searchText: (row) => row.rowGUID },
      { key: 'parent', title: 'Folder', type: 'select', target: 'rowParentGUID', width: 180, allowEmpty: false, placeholder: 'Choose folder…', options: folderOptions },
      { key: 'description', title: 'Description', type: 'text', width: 380 },
    ];
    return noCrud ? cols.map((col) => ({ ...col, editable: false })) : cols;
  }, [rows, folders, noCrud, c.text]);

  // ---- the days of the selected calendar and year ----
  const dayColumns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'day', title: 'Day', type: 'custom', width: 130, editable: false, renderCell: (row) => <Text style={{ color: c.text, fontSize: 13 }}>{String(row.rowJSON?.day ?? '')}</Text>, searchText: (row) => String(row.rowJSON?.day ?? '') },
    {
      key: 'weekday', title: 'Weekday', type: 'custom', width: 100, editable: false,
      renderCell: (row) => {
        const d = new Date(`${row.rowJSON?.day}T00:00:00Z`);
        return <Text style={{ color: c.text, opacity: 0.75, fontSize: 13 }}>{Number.isNaN(d.getTime()) ? '' : WEEKDAYS[d.getUTCDay()]}</Text>;
      },
      searchText: (row) => { const d = new Date(`${row.rowJSON?.day}T00:00:00Z`); return Number.isNaN(d.getTime()) ? '' : WEEKDAYS[d.getUTCDay()]; },
    },
    { key: 'isActive', title: 'Active', type: 'boolean', width: 90 },
    { key: 'reason', title: 'Reason', type: 'select', width: 130, options: REASON_OPTIONS, allowEmpty: false },
    { key: 'note', title: 'Note', type: 'text', width: 320 },
  ].map((col) => (noCrud ? { ...col, editable: false } : col)) as VisualColumn[], [noCrud, c.text]);
  // a day changed by hand is "manual" (a later Fill keeps it); a reason the user picked himself (holiday, manual) stays
  const computeDay = useCallback((json: Record<string, any>) => (json.reason === 'fill' || json.reason === 'weekend' ? { reason: 'manual' } : null), []);
  const readDays = useCallback(() => {
    const actions = SystemMetaData[MANAGEMENT_CALENDAR_DAYS_TABLE.entity]?.actions;
    if (actions?.readData && current) actions.readData && dispatch(actions.readData({ match: { rowOwnerGUID: current.rowGUID, rowParentGUID: String(year) }, paginationSize: 400 }));
  }, [current, year, dispatch]);
  useEffect(() => { readDays(); }, [readDays]);

  const years = useMemo(() => [currentYear - 1, currentYear, currentYear + 1], [currentYear]);

  return (
    <View testID="management-calendar-dashboard" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="calendar_month" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Management calendars</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
            {def.purpose} · {folders.length} folders · {calendars.length} calendars · {noCrud ? 'read-only' : 'editing is on'}
          </Text>
        </View>
        {!noCrud && <CalendarFillMenu calendarGUID={current?.rowGUID ?? null} currentYear={currentYear} onFilled={(y) => { setYear(y); readDays(); }} />}
        <PMIconButton tipScope="app" testID="management-calendar-edit-toggle" icon={noCrud ? 'lock' : 'lock_open'} title={noCrud ? 'Read-only: press to allow editing' : 'Editing is on: press to lock'} color={noCrud ? c.text : c.primary} onPress={() => setNoCrud((v) => !v)} />
        <PMIconButton tipScope="app" testID="management-calendar-reload" icon="refresh" title="Read the calendars again" color={c.text} onPress={() => { reload(); readDays(); }} />
      </View>
      {(error || (loaded && rows.length === 0)) && (
        <View testID="management-calendar-setup" style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {error ? `The calendars could not be read (${error}). ` : 'The calendar table is empty. '}
            Run kit8/sql/init/create_management_calendar_tables.sql in the Supabase SQL editor and sign in.
          </Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID="management-calendar-table"
          entityName={def.entity}
          crudListTitle="Calendars"
          itemLabel={def.itemLabel}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          visualColumns={columns}
          defaultRowJSON={def.emptyRowJSON}
          rowFilter={calendarsOnly}
          newRowDefaults={newRowDefaults}
          crudPanelEnabled={!noCrud}
          selectionEnabled={!noCrud}
          contextMenuEnabled={!noCrud}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          resizeColumnWidth
          realtime
          foldersTree={{ ...foldersTree, selectedFolderId: folder, onSelectedFolderChange: setFolder }}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 270 }}
        />

        {/* ---- the days of the selected calendar ---- */}
        <View style={styles.daysHead} testID="management-calendar-days-head">
          <Text style={[styles.h2, { color: c.text }]}>Days</Text>
          <View style={styles.chips}>
            {calendars.map((r) => {
              const on = r.rowGUID === current?.rowGUID;
              return (
                <Pressable key={r.rowGUID} testID={`management-calendar-pick-${r.rowGUID}`} accessibilityRole="button" aria-selected={on} onPress={() => setSelected(r.rowGUID)}
                  style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary + '18' : 'transparent' }]}>
                  <Text style={{ color: on ? c.primary : c.text, fontSize: 13, fontWeight: on ? '700' : '400' }}>{String(r.rowJSON?.title || r.rowGUID)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.chips}>
            {years.map((y) => (
              <Pressable key={y} testID={`management-calendar-year-${y}`} accessibilityRole="button" aria-selected={y === year} onPress={() => setYear(y)}
                style={[styles.chip, { borderColor: y === year ? c.primary : c.border, backgroundColor: y === year ? c.primary + '18' : 'transparent' }]}>
                <Text style={{ color: y === year ? c.primary : c.text, fontSize: 13, fontWeight: y === year ? '700' : '400' }}>{y}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {current ? (
          <ReusableTable
            key={`${current.rowGUID}-${year}`}
            testID="management-calendar-days-table"
            entityName={MANAGEMENT_CALENDAR_DAYS_TABLE.entity}
            crudListTitle={`${String(current.rowJSON?.title || current.rowGUID)} · ${year}`}
            itemLabel={MANAGEMENT_CALENDAR_DAYS_TABLE.itemLabel}
            listOwnerGUID={current.rowGUID}
            listParentGUID={String(year)}
            readParams={{ paginationSize: 400 }}
            visualColumns={dayColumns}
            computeRowJSON={computeDay}
            reorderEnabled={false}
            crudPanelEnabled={false}
            selectionEnabled={false}
            contextMenuEnabled={false}
            selectRowCheckBoxForm={selectRowCheckBoxForm}
            resizeColumnWidth
            realtime
            emptyText={`No days for ${year}: use Fill`}
            uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, zIndex: 20 },
  h1: { fontSize: 20, fontWeight: '800' },
  h2: { fontSize: 16, fontWeight: '800' },
  setup: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  content: { padding: 16, paddingBottom: 12, gap: 16, ...Platform.select({ web: { maxWidth: 1600 } as any, default: {} }) },
  daysHead: { gap: 8, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
});
