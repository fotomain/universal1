// PMPurchaseOrderDocumentForm - the FORM of purchase orders (documentation/PROJECT_STATE_WBS.html). ONE document = ONE vendor + ONE contract.
//
//   documents   the route gives one or MORE documents (the vendors the user checked in the choice window): a TAB for each (vendor · contract). On the web a real BROWSER TAB of its own can be opened for
//               each document (the icon on the tab; the choice window opens one for every document it made); on a phone the tab strip is the tab bar.
//   the bar     Delete · Unpost · Close - and the POST button is the LAST (a large button; the Posted state is the same size)
//   header      TextInputApp / DateInputApp / the catalog select: document number · legal entity · vendor · contract · currency (read only) · the NUMBER of the purchase order · its DATE · the totals
//   DocumentTabs All (default) · Time · Material · Expenses, with the number of lines of each - the same look as the Finances table of a task
//   the lines   a ReusableTable on the redux entity PURCHASE_ORDER_LINES_ENTITY (PurchaseOrderLines; realtime, optimistic): quantity, price and VAT % of a DRAFT are editable and can be deleted; no new
//               lines (they come from the task lines); a posted document is read only. Columns: purchaseOrderColumns.tsx.
// MULTI PROJECT (project setting multiProjectVendorInvoceNeeded): a chevron button at the left of the Project field chooses Single Project | Multi Project (saved at once). In Multi Project the lines table gets
//   purchaseOrderLineProject (read only) · purchaseOrderTaskGUID · purchaseOrderTaskLineGUID: on a DRAFT each of the two GUIDs is pasted from the clipboard (variant 1: "Copy GUID" of the task tree, "Copy line GUID" of the
//   Finances line), selected in the project tree window (variant 2: PMProjectPickerModal = the dashboard with the Finances view, press to select) or cleared. The lines table of the SQL RPC purchase_order_set_line_task.
// Post checks the whole document (the problems are listed) and writes the 'ordered' movements of the project status register in the same transaction. The 0333Effect correction is not built yet.
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
import ModalWindowListToSelect from '../../../ui/components/common/ModalWindowListToSelect';
import type { PMPickedPlace } from '../../../pm/view/project/pick/pmPickerContext';
import { extractGUID, placeChange, placesSignature } from '../lineplace/linePlaceModel';
import type { PlaceField } from '../lineplace/linePlaceModel';
import { pmT } from '../../../pm/i18n/pmT';
import { buildPurchaseOrderColumns } from './purchaseOrderColumns';
import PMPurchaseOrderDocumentHeader from './PMPurchaseOrderDocumentHeader';
import PMPurchaseOrderDocumentLines from './PMPurchaseOrderDocumentLines';
import {
  PURCHASE_ORDER_ALL_TAB, PURCHASE_ORDER_LINES_ENTITY, PURCHASE_ORDER_PROJECT_MODES, PURCHASE_ORDER_TABS, PurchaseOrderPostProblem, canChooseProjectMode, canDeletePurchaseOrder, canEditPurchaseOrder, canPostPurchaseOrder, canUnpostPurchaseOrder,
  purchaseOrderDocumentPath, purchaseOrderLinesOf, purchaseOrderMissing, purchaseOrderProblemText, purchaseOrderTotals,
} from './purchaseOrderModel';
import { usePurchaseOrderDocuments, usePurchaseOrderLinePlaces } from './usePurchaseOrder';

// the project tree window (it carries the whole dashboard, Skia included) is loaded when the user opens it
const PMProjectPickerModal = React.lazy(() => Promise.resolve(require('../../../pm/view/project/pick/PMProjectPickerModal')));

export interface PMPurchaseOrderDocumentFormProps {
  /** the documents of the form: one tab each (the first is open) */
  documents: string[];
  onClose?: () => void;
  testID?: string;
}

// Parts of the form: PMPurchaseOrderDocumentHeader (the fields + totals) and PMPurchaseOrderDocumentLines (DocumentTabs + the lines table); this file keeps the bar, the document tabs, the state and the commands.
export default function PMPurchaseOrderDocumentForm({ documents, onClose, testID = 'purchase-order' }: PMPurchaseOrderDocumentFormProps) {
  const { themeColors: c } = useDesignSystem();
  const data = useTaskLineCatalogs(true);
  const doc = usePurchaseOrderDocuments(documents);
  const [selected, setSelected] = useState<string>(documents[0] ?? '');
  const [tab, setTab] = useState<string>(PURCHASE_ORDER_ALL_TAB);
  const [problems, setProblems] = useState<PurchaseOrderPostProblem[]>([]);
  // the documents the route names, in its order; one that is not (yet) readable is left out
  const header = doc.headers.find((h) => h.guid === selected) ?? doc.headers[0] ?? null;
  useEffect(() => { if (documents.length && !documents.includes(selected)) setSelected(documents[0]); }, [documents, selected]);

  // the lines the table holds (redux): the counts of the tabs, the totals, Post needs lines
  const allRows: any[] = useSelector((s: any) => s?.[PURCHASE_ORDER_LINES_ENTITY]?.entityDataFromServer) ?? [];
  const docRows = useMemo(() => purchaseOrderLinesOf(allRows, header?.guid), [allRows, header?.guid]);
  const totals = useMemo(() => purchaseOrderTotals(docRows), [docRows]);
  const counts = useMemo(() => Object.fromEntries(PURCHASE_ORDER_TABS.map((t) => [t.id, purchaseOrderLinesOf(docRows, header?.guid, t.id).length])), [docRows, header?.guid]);
  useEffect(() => setProblems([]), [header?.guid]);

  const edit = !!header && canEditPurchaseOrder(header);
  // an UNPOSTED document lets its vendor and contract be chosen / changed (saved at once); the project setting independentInvoiceInputAvailable lets lines be ADDED by hand (not tied to a task line)
  const independent = edit && !!header?.independentInputAvailable;

  // ---- Single Project | Multi Project: the chevron at the left of the Project field; in Multi each line has a task / task line (paste · select in the project tree · clear) ----
  const multi = !!header?.multiProject;
  const [modeMenu, setModeMenu] = useState(false);
  const [pickFor, setPickFor] = useState<{ rowGUID: string; field: PlaceField } | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const places = usePurchaseOrderLinePlaces(header?.guid, placesSignature(docRows), multi);
  const changePlace = async (rowGUID: string, field: PlaceField, guid: string | null) => {
    const ch = placeChange(field, guid);
    setPlaceError(null);
    await doc.setLineTask(rowGUID, ch.task, ch.taskLine);
  };
  const placeActions = useMemo(() => ({
    paste: async (field: PlaceField, row: ReusableTableRow) => {
      let text = '';
      try { text = await Clipboard.getStringAsync(); } catch { text = ''; }
      const guid = extractGUID(text);
      if (!guid) { setPlaceError(pmT(field === 'task' ? 'The clipboard has no GUID: copy the GUID of a task ("Copy GUID" of the task row menu) and paste it here.' : 'The clipboard has no GUID: copy the GUID of a line ("Copy line GUID" of the Finances line menu) and paste it here.')); return; }
      await changePlace(String(row.rowGUID), field, guid);
    },
    pick: (field: PlaceField, row: ReusableTableRow) => { setPlaceError(null); setPickFor({ rowGUID: String(row.rowGUID), field }); },
    clear: (field: PlaceField, row: ReusableTableRow) => { void changePlace(String(row.rowGUID), field, null); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [doc.setLineTask]);
  const onPicked = (place: PMPickedPlace) => {
    const target = pickFor;
    setPickFor(null);
    if (!target) return;
    if (target.field === 'taskLine' && place.taskLineGUID) void changePlace(target.rowGUID, 'taskLine', place.taskLineGUID);
    else void changePlace(target.rowGUID, 'task', place.taskGUID);
  };
  const columns = useMemo(() => buildPurchaseOrderColumns({ data, tab, editable: edit, independent, multiProject: multi, places, placeActions }), [data, tab, edit, independent, multi, places, placeActions]);
  const rowFilter = useMemo(() => {
    const guid = header?.guid;
    return (r: ReusableTableRow) => !!guid && r.rowHeaderGUID === guid && (tab === PURCHASE_ORDER_ALL_TAB || r.genusGUID === tab);
  }, [header?.guid, tab]);

  // the number and the date of the purchase order: typed here, saved a moment after the last key (a valid day only)
  const [number, setNumber] = useState('');
  const [day, setDay] = useState('');
  useEffect(() => { setNumber(header?.purchaseOrderNumber ?? ''); setDay(header?.day ?? ''); }, [header?.guid, header?.purchaseOrderNumber, header?.day]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const commit = (patch: { purchaseOrderNumber?: string; purchaseOrderDateTime?: string | null }) => {
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
  const missing = header ? purchaseOrderMissing({ ...header, purchaseOrderNumber: number, day: parseDayInput(day) ?? '' }, docRows.length) : [];
  const openInBrowserTab = (guid: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(purchaseOrderDocumentPath(guid), '_blank');
  };

  return (
    <View testID={testID} style={styles.root}>
      {/* the bar: the POST button is the last */}
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="receipt_long" size={20} color={c.primary} />
        <View style={{ flexShrink: 1 }}>
          <Text testID={`${testID}-title`} numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Purchase order')}{header?.partnerTitle ? ` · ${header.partnerTitle}` : header ? ` · ${pmT('No vendor')}` : ''}</Text>
          {header && (
            <Text testID={`${testID}-subtitle`} numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
              {header.number}{header.contractInfo ? ` · ${header.contractInfo}` : ` · ${pmT('no contract')}`}{header.currency ? ` · ${header.currency}` : ''}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }} />
        {header && canDeletePurchaseOrder(header) && (
          <ButtonApp testID={`${testID}-delete`} title={pmT('Delete document')} icon="delete" variant="text" danger size="small" disabled={doc.busy} onPress={() => { void doDelete(); }} />
        )}
        {header && canUnpostPurchaseOrder(header) && (
          <ButtonApp testID={`${testID}-unpost`} title={pmT('Unpost')} icon="undo" variant="outlined" size="small" disabled={doc.busy} onPress={doUnpost} />
        )}
        {onClose && <ButtonApp testID={`${testID}-close`} title={pmT('Close')} variant="text" size="small" onPress={onClose} />}
        {header && header.status === 'posted' && (
          // a status, not a command: the same BIG button as Post (nothing to press)
          <ButtonApp testID={`${testID}-posted`} title={pmT('Posted')} icon="check" size="large" onPress={() => {}} accessibilityLabel={pmT('Posted')} />
        )}
        {header && canPostPurchaseOrder(header, docRows.length) && (
          <ButtonApp testID={`${testID}-post`} title={pmT('Post')} icon="send" size="large" disabled={doc.busy} onPress={doPost} />
        )}
      </View>

      {/* one tab for each vendor + contract: a browser tab of its own on the web, the tab strip on a phone */}
      {documents.length > 1 && (
        <ScrollView horizontal accessibilityRole="tablist" testID={`${testID}-documents`} showsHorizontalScrollIndicator={false} style={[styles.docTabs, { borderBottomColor: c.border }]}>
          {doc.headers.map((h) => {
            const active = h.guid === header?.guid;
            return (
              <View key={h.guid} style={[styles.docTab, { borderBottomColor: active ? c.primary : 'transparent' }]}>
                <Pressable accessibilityRole="tab" aria-selected={active} testID={`${testID}-document-${h.guid}`} onPress={() => setSelected(h.guid)} style={styles.docTabText}>
                  <Text numberOfLines={1} style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{h.partnerTitle || h.partnerGUID || pmT('No vendor')}</Text>
                  <Text numberOfLines={1} style={{ color: c.text, opacity: 0.6, fontSize: 11 }}>{h.contractInfo || pmT('no contract')} · {h.number}{h.status === 'posted' ? ` · ${pmT('Posted')}` : ''}</Text>
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

      {/* the header of the document */}
      {header && (
        <PMPurchaseOrderDocumentHeader
          testID={testID} header={header} edit={edit} multi={multi} number={number} day={day} dayError={dayError} totals={totals} setHeader={doc.setHeader}
          onNumber={(text) => { setNumber(text); commit({ purchaseOrderNumber: text }); }}
          onDay={(text) => { setDay(text); const d = parseDayInput(text); if (d) commit({ purchaseOrderDateTime: `${d}T00:00:00.000Z` }); }}
          onOpenModeMenu={() => setModeMenu(true)}
        />
      )}

      {!!doc.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{doc.error}</Text>}
      {!!placeError && <Text testID={`${testID}-place-error`} style={{ color: c.error, paddingHorizontal: 12, paddingTop: 4, fontSize: 12 }}>{placeError}</Text>}

      {edit && missing.length > 0 && (
        <Text testID={`${testID}-missing`} style={{ color: c.text, opacity: 0.7, fontSize: 12, paddingHorizontal: 12, paddingTop: 4 }}>{missing.map((m) => pmT(purchaseOrderProblemText(m))).join(' · ')}</Text>
      )}
      {problems.length > 0 && (
        <View testID={`${testID}-problems`} style={[styles.problems, { borderColor: c.error }]}>
          <Text style={{ color: c.error, fontWeight: '700', marginBottom: 4 }}>{pmT('The document was not posted:')}</Text>
          {problems.map((p, i) => (
            <Text key={`${p.lineGUID}-${i}`} testID={`${testID}-problem-${i}`} style={{ color: c.text, fontSize: 13 }}>• {pmT(purchaseOrderProblemText(p.problem))}</Text>
          ))}
        </View>
      )}

      <PMPurchaseOrderDocumentLines
        testID={testID} header={header} tab={tab} onTab={setTab} counts={counts} columns={columns} rowFilter={rowFilter} edit={edit} independent={independent} multi={multi} loading={doc.isLoading}
        onAddLine={(genus) => { if (header) void doc.addLine(header.guid, genus); }}
      />
      {header && (
        <>
          <ModalWindowListToSelect
            visible={modeMenu} testID={`${testID}-project-mode-list`} title={pmT('Project mode')} message={pmT('Single Project: all the lines belong to the project of the document. Multi Project: each line can belong to any task or task line of your projects.')}
            items={PURCHASE_ORDER_PROJECT_MODES.map((m) => ({ id: m.id, title: pmT(m.title), subtitle: pmT(m.subtitle), icon: m.icon }))} selectedId={multi ? 'multi' : 'single'} cancelLabel={pmT('Cancel')}
            onClose={() => setModeMenu(false)}
            onSelect={(id) => { setModeMenu(false); if ((id === 'multi') !== multi) void doc.setHeader(header.guid, { purchaseOrderMultiProject: id === 'multi' }); }}
          />
          {!!pickFor && (
            <React.Suspense fallback={null}>
              <PMProjectPickerModal testID={`${testID}-picker`} visible mode={pickFor.field === 'taskLine' ? 'line' : 'task'} onPick={onPicked} onClose={() => setPickFor(null)} />
            </React.Suspense>
          )}
        </>
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
