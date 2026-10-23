// PMPaymentFactDocumentForm - the FORM of a payment fact (SQL: PART 38): ONE bank transaction. ONE document = ONE money account + ONE payee + ONE direction + ONE date.
//
//   documents   the route gives one or MORE documents: a TAB for each (money account · payee). On the web a real BROWSER TAB of its own can be opened for each document (the icon on the tab).
//   the bar     Get from plan · Delete · Unpost · Close - and the POST button is the LAST (a large button; the Posted state is the same size)
//   header      PMPaymentFactDocumentHeader: document number · date · bank transaction no. · money account · currency · direction · payee · bank amount · the totals
//   the lines   PMPaymentFactDocumentLines: a ReusableTable on the redux entity PAYMENT_FACT_LINES_ENTITY. The lines come from "Get from plan" = the POSTED payments of the payment plan with something open
//               (PMPaymentFactGetFromPlan); an unplanned line (+) needs a task: the one of the document, or pasted / selected in the cell.
// Post checks the whole document (the problems are listed) and writes one signed row per line into cash_account_ledger_movements in the same transaction; the rests of the account follow.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import type { ReusableTableRow } from '../../../ui/components/table/reusable/reusableTableTypes';
import { useTaskLineCatalogs } from '../../../pm/view/task/finances/useTaskLineCatalogs';
import { parseDayInput } from '../../fact/input/factInputModel';
import { extractGUID, PlaceField } from '../../vendor/lineplace/linePlaceModel';
import type { PMPickedPlace } from '../../../pm/view/project/pick/pmPickerContext';
import { pmT } from '../../../pm/i18n/pmT';
import { buildPaymentFactColumns, paymentFactErrors } from './paymentFactColumns';
import {
  PAYMENT_FACT_LINES_ENTITY, PaymentFactPostProblem, canDeletePaymentFact, canEditPaymentFact, canGetFromPlan, canPostPaymentFact, canUnpostPaymentFact, paymentFactDocumentPath, paymentFactLinesOf, paymentFactMissing,
  paymentFactProblemText, paymentFactTotals, skipReasonText,
} from './paymentFactModel';
import { usePaymentFactDocuments } from './usePaymentFact';
import { usePaymentFactPlaces } from './usePaymentFactPlaces';
import PMPaymentFactDocumentHeader from './PMPaymentFactDocumentHeader';
import PMPaymentFactDocumentLines from './PMPaymentFactDocumentLines';
import PMPaymentFactGetFromPlan from './PMPaymentFactGetFromPlan';

// the project tree window (a picker) is loaded when needed: the form's tests do not load Skia
const PMProjectPickerModal = React.lazy(() => Promise.resolve(require('../../../pm/view/project/pick/PMProjectPickerModal')));

export interface PMPaymentFactDocumentFormProps {
  /** the documents of the form: one tab each (the first is open) */
  documents: string[];
  onClose?: () => void;
  testID?: string;
}

export default function PMPaymentFactDocumentForm({ documents, onClose, testID = 'payment-fact' }: PMPaymentFactDocumentFormProps) {
  const { themeColors: c } = useDesignSystem();
  const data = useTaskLineCatalogs(true);
  const doc = usePaymentFactDocuments(documents);
  const [selected, setSelected] = useState<string>(documents[0] ?? '');
  const [problems, setProblems] = useState<PaymentFactPostProblem[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const header = doc.headers.find((h) => h.guid === selected) ?? doc.headers[0] ?? null;
  useEffect(() => { if (documents.length && !documents.includes(selected)) setSelected(documents[0]); }, [documents, selected]);

  // the lines the table holds (redux): the totals, Post needs lines
  const allRows: any[] = useSelector((s: any) => s?.[PAYMENT_FACT_LINES_ENTITY]?.entityDataFromServer) ?? [];
  const docRows = useMemo(() => paymentFactLinesOf(allRows, header?.guid), [allRows, header?.guid]);
  const totals = useMemo(() => paymentFactTotals(docRows), [docRows]);
  const places = usePaymentFactPlaces(docRows);
  useEffect(() => { setProblems([]); setNotice(null); }, [header?.guid]);

  const edit = !!header && canEditPaymentFact(header);
  const payee = header ? (header.partnerGUID ? { kind: 'partner' as const, guid: header.partnerGUID } : header.personGUID ? { kind: 'person' as const, guid: header.personGUID } : null) : null;

  // ---- the task of an UNPLANNED line: paste (the GUID of "Copy GUID" of a task) · select in the project tree · clear (back to the task of the document) ----
  const [pickFor, setPickFor] = useState<{ rowGUID: string } | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const changeTask = async (rowGUID: string, taskGUID: string | null) => {
    setPlaceError(null);
    const target = taskGUID || header?.taskGUID;
    if (!target) { setPlaceError(pmT('The document has no task: choose one.')); return; }
    await doc.setLineTask(rowGUID, target);
  };
  const placeActions = useMemo(() => ({
    paste: async (_field: PlaceField, row: ReusableTableRow) => {
      let text = '';
      try { text = await Clipboard.getStringAsync(); } catch { text = ''; }
      const guid = extractGUID(text);
      if (!guid) { setPlaceError(pmT('The clipboard has no GUID: copy the GUID of a task ("Copy GUID" of the task row menu) and paste it here.')); return; }
      await changeTask(String(row.rowGUID), guid);
    },
    pick: (_field: PlaceField, row: ReusableTableRow) => { setPlaceError(null); setPickFor({ rowGUID: String(row.rowGUID) }); },
    clear: (_field: PlaceField, row: ReusableTableRow) => { void changeTask(String(row.rowGUID), null); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [doc.setLineTask, header?.taskGUID]);
  const onPicked = (place: PMPickedPlace) => {
    const target = pickFor;
    setPickFor(null);
    if (target) void changeTask(target.rowGUID, place.taskGUID);
  };

  const anyError = useMemo(() => docRows.some((r) => paymentFactErrors(r).length > 0), [docRows]);
  const columns = useMemo(() => buildPaymentFactColumns({
    data, direction: header?.direction ?? '', payee, accountCurrency: header?.currency ?? '', editable: edit, places, placeActions: edit ? placeActions : undefined, textColor: c.text, errorColor: c.error, showErrors: anyError,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, header?.direction, header?.partnerGUID, header?.personGUID, header?.currency, edit, places, placeActions, c.text, c.error, anyError]);
  const rowFilter = useMemo(() => {
    const guid = header?.guid;
    return (r: ReusableTableRow) => !!guid && r.rowHeaderGUID === guid;
  }, [header?.guid]);

  // the number, the date and the bank amount: typed here, saved a moment after the last key (a valid day only)
  const [number, setNumber] = useState('');
  const [day, setDay] = useState('');
  const [bank, setBank] = useState('');
  useEffect(() => {
    setNumber(header?.paymentFactNumber ?? '');
    setDay(header?.day ?? '');
    setBank(header?.bankAmount === null || header?.bankAmount === undefined ? '' : String(header.bankAmount));
  }, [header?.guid, header?.paymentFactNumber, header?.day, header?.bankAmount]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const commit = (patch: { paymentFactNumber?: string; paymentFactDate?: string | null; paymentFactBankAmount?: number | null }) => {
    if (!header || !edit) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void doc.setHeader(header.guid, patch); }, 500);
  };
  const dayError = !!day.trim() && parseDayInput(day) === null;

  const doPost = async () => {
    if (!header) return;
    const answer = await doc.post(header.guid);
    setProblems(answer && answer.status !== 'posted' ? answer.problems : []);
  };
  const doUnpost = async () => {
    if (!header) return;
    const answer = await doc.unpost(header.guid);
    setProblems(answer && answer.status !== 'draft' ? answer.problems : []);
  };
  const doDelete = async () => {
    if (!header) return;
    const ok = await doc.remove(header.guid);
    if (ok) {
      const rest = documents.filter((g) => g !== header.guid);
      if (rest.length) setSelected(rest[0]); else onClose?.();
    }
  };
  const doAddFromPlan = async (planLineGUIDs: string[]) => {
    if (!header) return;
    const answer = await doc.addFromPlan(header.guid, planLineGUIDs);
    if (answer && answer.skipped.length) setNotice(answer.skipped.map((s) => pmT(skipReasonText(s.reason))).join(' · '));
    else setNotice(null);
  };
  const missing = header ? paymentFactMissing({ ...header, paymentFactNumber: number, day: parseDayInput(day) ?? '' }, docRows.length) : [];
  const openInBrowserTab = (guid: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(paymentFactDocumentPath(guid), '_blank');
  };

  return (
    <View testID={testID} style={styles.root}>
      {/* the bar: the POST button is the last */}
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="account_balance" size={20} color={c.primary} />
        <View style={{ flexShrink: 1 }}>
          <Text testID={`${testID}-title`} numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Payment fact')}{header?.payeeTitle ? ` · ${header.payeeTitle}` : header ? ` · ${pmT('No payee')}` : ''}</Text>
          {header && (
            <Text testID={`${testID}-subtitle`} numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
              {header.number}{header.moneyAccountTitle ? ` · ${header.moneyAccountTitle}` : ` · ${pmT('no money account')}`}{header.currency ? ` · ${header.currency}` : ''}{header.projectCount > 1 ? ` · ${header.projectCount} ${pmT('projects')}` : ''}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }} />
        {header && canGetFromPlan(header) && (
          <ButtonApp testID={`${testID}-get-from-plan`} title={pmT('Get from plan')} icon="playlist_add_check" variant="outlined" size="small" disabled={doc.busy} onPress={() => setPlanOpen(true)} />
        )}
        {header && canDeletePaymentFact(header) && (
          <ButtonApp testID={`${testID}-delete`} title={pmT('Delete document')} icon="delete" variant="text" danger size="small" disabled={doc.busy} onPress={() => { void doDelete(); }} />
        )}
        {header && canUnpostPaymentFact(header) && (
          <ButtonApp testID={`${testID}-unpost`} title={pmT('Unpost')} icon="undo" variant="outlined" size="small" disabled={doc.busy} onPress={doUnpost} />
        )}
        {onClose && <ButtonApp testID={`${testID}-close`} title={pmT('Close')} variant="text" size="small" onPress={onClose} />}
        {header && header.status === 'posted' && (
          // a status, not a command: the same BIG button as Post (nothing to press)
          <ButtonApp testID={`${testID}-posted`} title={pmT('Posted')} icon="check" size="large" onPress={() => {}} accessibilityLabel={pmT('Posted')} />
        )}
        {header && canPostPaymentFact(header, docRows.length) && (
          <ButtonApp testID={`${testID}-post`} title={pmT('Post')} icon="send" size="large" disabled={doc.busy} onPress={doPost} />
        )}
      </View>

      {/* one tab for each document: a browser tab of its own on the web, the tab strip on a phone */}
      {documents.length > 1 && (
        <ScrollView horizontal accessibilityRole="tablist" testID={`${testID}-documents`} showsHorizontalScrollIndicator={false} style={[styles.docTabs, { borderBottomColor: c.border }]}>
          {doc.headers.map((h) => {
            const active = h.guid === header?.guid;
            return (
              <View key={h.guid} style={[styles.docTab, { borderBottomColor: active ? c.primary : 'transparent' }]}>
                <Pressable accessibilityRole="tab" aria-selected={active} testID={`${testID}-document-${h.guid}`} onPress={() => setSelected(h.guid)} style={styles.docTabText}>
                  <Text numberOfLines={1} style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{h.payeeTitle || pmT('No payee')}</Text>
                  <Text numberOfLines={1} style={{ color: c.text, opacity: 0.6, fontSize: 11 }}>{h.moneyAccountTitle || pmT('no money account')} · {h.number}{h.status === 'posted' ? ` · ${pmT('Posted')}` : ''}</Text>
                </Pressable>
                {Platform.OS === 'web' && (
                  <Pressable accessibilityRole="button" accessibilityLabel={pmT('Open in a browser tab')} testID={`${testID}-document-${h.guid}-browser-tab`} onPress={() => openInBrowserTab(h.guid)} hitSlop={6}>
                    <IconApp name="open_in_new" size={16} color={c.text} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {header && (
        <PMPaymentFactDocumentHeader
          header={header} edit={edit} lineCount={docRows.length} number={number} day={day} dayError={dayError} bankAmount={bank} totals={totals} setHeader={doc.setHeader} testID={testID}
          onNumber={(t) => { setNumber(t); commit({ paymentFactNumber: t }); }}
          onDay={(t) => { setDay(t); const d = parseDayInput(t); if (d) commit({ paymentFactDate: d }); }}
          onBankAmount={(t) => { setBank(t); const n = t.trim() === '' ? null : Number(t.replace(',', '.')); if (n === null || (Number.isFinite(n) && n >= 0)) commit({ paymentFactBankAmount: n }); }}
        />
      )}

      {!!doc.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{doc.error}</Text>}
      {!!placeError && <Text testID={`${testID}-place-error`} style={{ color: c.error, padding: 10 }}>{placeError}</Text>}
      {!!notice && <Text testID={`${testID}-notice`} style={{ color: c.text, opacity: 0.8, fontSize: 12, paddingHorizontal: 12, paddingTop: 4 }}>{notice}</Text>}

      {edit && missing.length > 0 && (
        <Text testID={`${testID}-missing`} style={{ color: c.text, opacity: 0.7, fontSize: 12, paddingHorizontal: 12, paddingTop: 4 }}>{missing.map((m) => pmT(paymentFactProblemText(m))).join(' · ')}</Text>
      )}
      {problems.length > 0 && (
        <View testID={`${testID}-problems`} style={[styles.problems, { borderColor: c.error }]}>
          <Text style={{ color: c.error, fontWeight: '700', marginBottom: 4 }}>{pmT('The document was not posted:')}</Text>
          {problems.map((p, i) => (
            <Text key={`${p.lineGUID}-${i}`} testID={`${testID}-problem-${i}`} style={{ color: c.text, fontSize: 13 }}>• {pmT(paymentFactProblemText(p.problem))}</Text>
          ))}
        </View>
      )}

      <PMPaymentFactDocumentLines
        header={header} columns={columns} rowFilter={rowFilter} edit={edit} loading={doc.isLoading}
        onAddLine={() => { void doc.addLine(header!.guid, header?.taskGUID || null); }}
        testID={testID}
      />

      {header && planOpen && (
        <PMPaymentFactGetFromPlan visible header={header} taskGUID={header.taskGUID || null} onAdd={doAddFromPlan} onClose={() => setPlanOpen(false)} testID={`${testID}-plan`} />
      )}
      {!!pickFor && (
        <React.Suspense fallback={null}>
          <PMProjectPickerModal testID={`${testID}-picker`} visible mode="task" onPick={onPicked} onClose={() => setPickFor(null)} />
        </React.Suspense>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  docTabs: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  docTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 2 },
  docTabText: { maxWidth: 240 },
  problems: { margin: 12, padding: 10, borderWidth: 1, borderRadius: 8 },
});
