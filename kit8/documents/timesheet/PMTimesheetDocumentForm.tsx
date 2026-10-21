// PMTimesheetDocumentForm - the FORM of a time sheet (documentation/TIME_SHEET_WBS.html). ONE document = ONE work center + ONE period; the lines are project / task / role (+ budget item, business unit) with ONE
// COLUMN FOR EVERY DAY of the period; Draft → Post writes the entered hours as 'used' movements of the project status register (Monitor01 column Used).
//   the bar     Delete · Unpost · Close - and the POST button is the LAST (a large button; the Posted state is the same size)
//   header      PMTimesheetDocumentHeader: document · organization (disabled) · work center (+ "Create work center") · start / finish date · the period selector
//   lines       PMTimesheetDocumentLines: the day columns, the hour cells (empty at the start, only entered hours are posted)
//   problems    Post answers with data { status, problems[] } (never an exception): the problems are listed, each names its line and day
// A change of the period or of the work center that would drop entered hours / clear roles asks first.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { showSnackbar } from '../../redux/uxuiSlice';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ButtonApp from '../../ui/components/common/ButtonApp';
import IconApp from '../../ui/components/common/IconApp';
import { ModalAskComponent } from '../../ui/components/common/ModalAskComponent';
import ModalWindowListToSelect from '../../ui/components/common/ModalWindowListToSelect';
import { parseDayInput } from '../fact/input/factInputModel';
import { pmT } from '../../pm/i18n/pmT';
import PMTimesheetDocumentHeader from './PMTimesheetDocumentHeader';
import PMTimesheetDocumentLines from './PMTimesheetDocumentLines';
import {
  TimesheetPostProblem, canDeleteTimesheet, canEditTimesheet, canPostTimesheet, canUnpostTimesheet, enteredOutside, hoursOfSheet, timesheetPeriodProblem, timesheetPeriodProblemText, timesheetProblemLine,
} from './timesheetModel';
import { useMyWorkCenter, useTimesheetDocument, useTimesheetOptions } from './useTimesheet';

export interface PMTimesheetDocumentFormProps {
  /** project_timesheet_header.rowGUID */
  documentGUID: string;
  onClose?: () => void;
  testID?: string;
}

type Pending = { kind: 'period'; startDate: string; finishDate: string; dropped: number } | { kind: 'workCenter'; guid: string } | null;

export default function PMTimesheetDocumentForm({ documentGUID, onClose, testID = 'timesheet' }: PMTimesheetDocumentFormProps) {
  const { themeColors: c } = useDesignSystem();
  const doc = useTimesheetDocument(documentGUID);
  const dispatch = useDispatch();
  const header = doc.header;
  const options = useTimesheetOptions(header?.workCenter ?? '', true);
  const my = useMyWorkCenter(true);
  const organizationTitle: string = useSelector((s: any) => s?.activeUserState?.userOrganization?.title) || '';
  const [problems, setProblems] = useState<TimesheetPostProblem[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const [periodMessage, setPeriodMessage] = useState('');
  const edit = !!header && canEditTimesheet(header);
  // the work center of the sheet may not be in the list the user may pick (a sheet made from a Time line keeps THAT line's work center): it is added, with its title
  const [wcTitles, setWcTitles] = useState<Record<string, string>>({});
  const headerWc = header?.workCenter ?? '';
  const knownWc = options.workCenters.some((w: { value: string }) => w.value === headerWc);
  useEffect(() => {
    if (!headerWc || knownWc || wcTitles[headerWc] !== undefined) return;
    let alive = true;
    void options.titleOf('workCenterTable', headerWc).then((t: string) => { if (alive) setWcTitles((m) => ({ ...m, [headerWc]: t })); }).catch(() => undefined);
    return () => { alive = false; };
  }, [headerWc, knownWc]); // eslint-disable-line react-hooks/exhaustive-deps
  const workCenterOptions = useMemo(
    () => (headerWc && !knownWc ? [{ value: headerWc, label: wcTitles[headerWc] || headerWc }, ...options.workCenters] : options.workCenters),
    [options.workCenters, headerWc, knownWc, wcTitles],
  );

  // the dates as typed; a valid, allowed period (both dates) is saved
  const [startText, setStartText] = useState('');
  const [finishText, setFinishText] = useState('');
  useEffect(() => { setStartText(header?.startDate ?? ''); setFinishText(header?.finishDate ?? ''); setPeriodMessage(''); }, [header?.rowGUID, header?.startDate, header?.finishDate]);
  useEffect(() => setProblems([]), [documentGUID]);
  const startDay = parseDayInput(startText);
  const finishDay = parseDayInput(finishText);

  const askPeriod = (startDate: string, finishDate: string) => {
    if (!header) return;
    if (startDate === header.startDate && finishDate === header.finishDate) { setPeriodMessage(''); return; }
    const problem = timesheetPeriodProblem(startDate, finishDate, options.switches.onlyCurrentMonth);
    if (problem) { setPeriodMessage(pmT(timesheetPeriodProblemText(problem))); return; }
    setPeriodMessage('');
    const dropped = enteredOutside(doc.entered, startDate, finishDate).length;
    if (dropped > 0) setPending({ kind: 'period', startDate, finishDate, dropped });
    else void doc.setHeader({ startDate, finishDate });
  };
  const onStartText = (text: string) => { setStartText(text); const d = parseDayInput(text); if (d && header) askPeriod(d, parseDayInput(finishText) ?? header.finishDate); };
  const onFinishText = (text: string) => { setFinishText(text); const d = parseDayInput(text); if (d && header) askPeriod(parseDayInput(startText) ?? header.startDate, d); };

  const askWorkCenter = (guid: string) => {
    if (!header || guid === header.workCenter) return;
    if (doc.lines.some((l) => l.role || l.budgetItem || l.businessUnit)) setPending({ kind: 'workCenter', guid });
    else void doc.setHeader({ timesheetWorkCenter: guid });
  };
  const confirmPending = () => {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (p.kind === 'period') void doc.setHeader({ startDate: p.startDate, finishDate: p.finishDate });
    else void doc.setHeader({ timesheetWorkCenter: p.guid });
  };

  // "Create work center": the work center of the Person of the user; the sheet takes it at once
  const takeWorkCenter = async (unit?: string | null) => {
    const a = await my.create(unit);
    if (a && (a.status === 'created' || a.status === 'exists') && a.workCenter) void doc.setHeader({ timesheetWorkCenter: a.workCenter });
  };

  const doPost = async () => {
    const a = await doc.post();
    setProblems(a && a.status !== 'posted' ? a.problems : []);
    // the snack bar tells that the sheet is posted (the movements are in the register: Monitor01 Used)
    if (a?.status === 'posted') dispatch(showSnackbar({ message: pmT('Time sheet {{n}} posted: {{h}} hours, {{c}} cells', { n: header?.documentNumber ?? '', h: hours, c: doc.entered.length }), isError: false, duration: 4000 }));
  };
  const doUnpost = async () => {
    const a = await doc.unpost();
    setProblems(a && a.status !== 'draft' ? a.problems : []);
    if (a?.status === 'draft') dispatch(showSnackbar({ message: pmT('Time sheet {{n}} unposted: it is a draft again', { n: header?.documentNumber ?? '' }), isError: false, duration: 3000 }));
  };
  const doDelete = async () => { if (await doc.remove()) onClose?.(); };

  const lineLabel = useMemo(() => new Map(doc.lines.map((l, i) => [l.rowGUID, i + 1])), [doc.lines]);
  const hours = hoursOfSheet(doc.entered);
  const canCreateWorkCenter = !my.isLoading && !my.workCenter;

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="schedule" size={20} color={c.primary} />
        <View style={{ flexShrink: 1 }}>
          <Text testID={`${testID}-title`} numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Time sheet')}{header ? ` · ${header.documentNumber}` : ''}</Text>
          {header && (
            <Text testID={`${testID}-subtitle`} numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
              {header.startDate} – {header.finishDate} · {hours} {pmT('hours')}{header.status === 'posted' ? ` · ${pmT('Posted')}` : ''}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }} />
        {header && canDeleteTimesheet(header) && (
          <ButtonApp testID={`${testID}-delete`} title={pmT('Delete document')} icon="delete" variant="text" danger size="small" disabled={doc.busy} onPress={() => { void doDelete(); }} />
        )}
        {header && canUnpostTimesheet(header) && (
          <ButtonApp testID={`${testID}-unpost`} title={pmT('Unpost')} icon="undo" variant="outlined" size="small" disabled={doc.busy} onPress={doUnpost} />
        )}
        {onClose && <ButtonApp testID={`${testID}-close`} title={pmT('Close')} variant="text" size="small" onPress={onClose} />}
        {header && header.status === 'posted' && (
          // a status, not a command: the same BIG button as Post (nothing to press)
          <ButtonApp testID={`${testID}-posted`} title={pmT('Posted')} icon="check" size="large" onPress={() => {}} accessibilityLabel={pmT('Posted')} />
        )}
        {header && canPostTimesheet(header, doc.entered.length) && (
          <ButtonApp testID={`${testID}-post`} title={pmT('Post')} icon="send" size="large" disabled={doc.busy} onPress={doPost} />
        )}
      </View>

      {header && (
        <PMTimesheetDocumentHeader
          testID={testID} header={header} edit={edit} organizationTitle={organizationTitle} workCenters={workCenterOptions}
          canCreateWorkCenter={canCreateWorkCenter} creatingWorkCenter={my.busy} onCreateWorkCenter={() => { void takeWorkCenter(null); }} onWorkCenter={askWorkCenter}
          startText={startText} finishText={finishText} startError={!!startText.trim() && !startDay} finishError={!!finishText.trim() && !finishDay}
          onStartText={onStartText} onFinishText={onFinishText} onPeriod={(p) => askPeriod(p.startDate, p.finishDate)}
          onlyCurrentMonth={options.switches.onlyCurrentMonth} periodMessage={periodMessage} hours={hours} lineCount={doc.lines.length}
        />
      )}

      {!!doc.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{doc.error}</Text>}
      {!!my.error && <Text testID={`${testID}-work-center-error`} style={{ color: c.error, padding: 10 }}>{my.error}</Text>}
      {edit && header && !header.workCenter && (
        <Text testID={`${testID}-no-work-center`} style={{ color: c.text, opacity: 0.75, fontSize: 12, paddingHorizontal: 12, paddingTop: 6 }}>
          {canCreateWorkCenter ? pmT('You have no work center yet: press Create work center.') : pmT('Choose the work center.')}
        </Text>
      )}

      {problems.length > 0 && (
        <View testID={`${testID}-problems`} style={[styles.problems, { borderColor: c.error }]}>
          <Text style={{ color: c.error, fontWeight: '700', marginBottom: 4 }}>{pmT('The time sheet was not posted:')}</Text>
          {problems.map((p, i) => (
            <Text key={`${p.lineGUID}-${p.day}-${i}`} testID={`${testID}-problem-${i}`} style={{ color: c.text, fontSize: 13 }}>
              • {p.lineGUID && lineLabel.get(p.lineGUID) ? `${pmT('Line')} ${lineLabel.get(p.lineGUID)}: ` : ''}{timesheetProblemLine(p, pmT)}
            </Text>
          ))}
        </View>
      )}

      <PMTimesheetDocumentLines
        testID={testID} header={header} lines={doc.lines} entered={doc.entered} options={options} edit={edit} loading={doc.isLoading}
        onAddLine={() => { void doc.addLine(); }} onSetLine={(guid, patch) => doc.setLine(guid, patch)} onDeleteLine={(guid) => { void doc.deleteLine(guid); }}
        onSetHours={(guid, day, h) => doc.setHours(guid, day, h)} onInsertLine={(ref, before, patch) => doc.insertLine(ref, before, patch)} onMoveLine={(guid, where) => doc.moveLine(guid, where)}
      />

      <ModalAskComponent
        visible={!!pending} testID={`${testID}-confirm`} modalTopBar={pending?.kind === 'period' ? pmT('Change the period?') : pmT('Change the work center?')}
        modalBody={pending?.kind === 'period'
          ? `${pmT('The hours entered on the days that leave the period are removed:')} ${pending.dropped} ${pmT('cells')}.`
          : pmT('The roles, budget items and business units of the lines depend on the work center and are cleared.')}
        confirmLabel={pmT('Change')} cancelLabel={pmT('Cancel')} confirmColor={c.primary} onCancel={() => setPending(null)} onConfirm={confirmPending}
      />
      <ModalWindowListToSelect
        visible={!!my.unitChoices} testID={`${testID}-unit-choice`} title={pmT('Business unit of your work center')} message={pmT('Choose the business unit (folder) of the new work center.')}
        items={(my.unitChoices ?? []).map((u) => ({ id: u.value, title: u.label }))} selectedId="" onClose={my.closeUnitChoices}
        onSelect={(id) => { my.closeUnitChoices(); void takeWorkCenter(id); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  problems: { margin: 12, padding: 10, borderWidth: 1, borderRadius: 8 },
});
