// PMProductReceiptDocumentForm - the FORM of product receipts (documentation/PRODUCT_RECEIPT.html). ONE document = ONE vendor + ONE contract; made from a POSTED purchase order.
//
//   documents   the route gives one or MORE documents: a TAB for each (vendor · contract). On the web a real BROWSER TAB of its own can be opened for each document (the icon on the tab).
//   the bar     Delete · Unpost · Create based on… (→ Vendor invoice, a POSTED receipt) · Close - and the POST button is the LAST (a large button; the Posted state is the same size)
//   header      TextInputApp / DateInputApp / the catalog select: document number · project · purchase order (read only) · legal entity · vendor · contract · currency (read only) · the NUMBER of the receipt · its DATE · the totals
//   DocumentTabs All (default) · Time · Material · Expenses, with the number of lines of each - the same look as the Finances table of a task
//   the lines   a ReusableTable on the redux entity PRODUCT_RECEIPT_LINES_ENTITY (realtime, optimistic): quantity, price and VAT % of a DRAFT are editable and can be deleted; the lines come from the purchase order
//               (and an independent line can be added when the project setting allows it); a posted document is read only. Columns: productReceiptColumns.tsx. A Multi Project order gives a Multi Project receipt: the
//               project / task / task line of every line are shown (read only).
// Post checks the whole document (the problems are listed) and writes the 'received' movements of the project status register in the same transaction: Monitor01 column Received.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import type { ReusableTableRow } from '../../../ui/components/table/reusable/reusableTableTypes';
import { useTaskLineCatalogs } from '../../../pm/view/task/finances/useTaskLineCatalogs';
import { parseDayInput } from '../../fact/input/factInputModel';
import ModalWindowListToSelect from '../../../ui/components/common/ModalWindowListToSelect';
import { placesSignature } from '../lineplace/linePlaceModel';
import { pmT } from '../../../pm/i18n/pmT';
import { buildProductReceiptColumns } from './productReceiptColumns';
import PMProductReceiptDocumentHeader from './PMProductReceiptDocumentHeader';
import PMProductReceiptDocumentLines from './PMProductReceiptDocumentLines';
import {
  PRODUCT_RECEIPT_ALL_TAB, PRODUCT_RECEIPT_LINES_ENTITY, PRODUCT_RECEIPT_TABS, ProductReceiptPostProblem, canCreateInvoiceFromReceipt, canDeleteProductReceipt, canEditProductReceipt, canPostProductReceipt, canUnpostProductReceipt, createFromSkippedText,
  productReceiptDocumentPath, productReceiptLinesOf, productReceiptMissing, productReceiptProblemText, productReceiptTotals,
} from './productReceiptModel';
import { useCreateVendorInvoiceFromReceipt, useProductReceiptDocuments, useProductReceiptLinePlaces } from './useProductReceipt';

export interface PMProductReceiptDocumentFormProps {
  /** the documents of the form: one tab each (the first is open) */
  documents: string[];
  onClose?: () => void;
  testID?: string;
}

// Parts of the form: PMProductReceiptDocumentHeader (the fields + totals) and PMProductReceiptDocumentLines (DocumentTabs + the lines table); this file keeps the bar, the document tabs, the state and the commands.
export default function PMProductReceiptDocumentForm({ documents, onClose, testID = 'product-receipt' }: PMProductReceiptDocumentFormProps) {
  const { themeColors: c } = useDesignSystem();
  const data = useTaskLineCatalogs(true);
  const doc = useProductReceiptDocuments(documents);
  const [selected, setSelected] = useState<string>(documents[0] ?? '');
  const [tab, setTab] = useState<string>(PRODUCT_RECEIPT_ALL_TAB);
  const [problems, setProblems] = useState<ProductReceiptPostProblem[]>([]);
  // the documents the route names, in its order; one that is not (yet) readable is left out
  const header = doc.headers.find((h) => h.guid === selected) ?? doc.headers[0] ?? null;
  useEffect(() => { if (documents.length && !documents.includes(selected)) setSelected(documents[0]); }, [documents, selected]);

  // the lines the table holds (redux): the counts of the tabs, the totals, Post needs lines
  const allRows: any[] = useSelector((s: any) => s?.[PRODUCT_RECEIPT_LINES_ENTITY]?.entityDataFromServer) ?? [];
  const docRows = useMemo(() => productReceiptLinesOf(allRows, header?.guid), [allRows, header?.guid]);
  const totals = useMemo(() => productReceiptTotals(docRows), [docRows]);
  const counts = useMemo(() => Object.fromEntries(PRODUCT_RECEIPT_TABS.map((t) => [t.id, productReceiptLinesOf(docRows, header?.guid, t.id).length])), [docRows, header?.guid]);
  useEffect(() => setProblems([]), [header?.guid]);

  const edit = !!header && canEditProductReceipt(header);
  // an UNPOSTED document lets its vendor and contract be chosen / changed (saved at once); the project setting independentInvoiceInputAvailable lets lines be ADDED by hand (not tied to a task line)
  const independent = edit && !!header?.independentInputAvailable;

  // ---- Multi Project (copied from the purchase order): the lines show their project / task / task line, read only ----
  const multi = !!header?.multiProject;
  const places = useProductReceiptLinePlaces(header?.guid, placesSignature(docRows), multi);
  const columns = useMemo(() => buildProductReceiptColumns({ data, tab, editable: edit, independent, multiProject: multi, places }), [data, tab, edit, independent, multi, places]);
  const rowFilter = useMemo(() => {
    const guid = header?.guid;
    return (r: ReusableTableRow) => !!guid && r.rowHeaderGUID === guid && (tab === PRODUCT_RECEIPT_ALL_TAB || r.genusGUID === tab);
  }, [header?.guid, tab]);

  // the number and the date of the product receipt: typed here, saved a moment after the last key (a valid day only)
  const [number, setNumber] = useState('');
  const [day, setDay] = useState('');
  useEffect(() => { setNumber(header?.productReceiptNumber ?? ''); setDay(header?.day ?? ''); }, [header?.guid, header?.productReceiptNumber, header?.day]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const commit = (patch: { productReceiptNumber?: string; productReceiptDateTime?: string | null }) => {
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
  // "Create based on → Vendor invoice" (a POSTED receipt): the draft invoice opens in a new browser tab
  const [basedOnMenu, setBasedOnMenu] = useState(false);
  const toInvoice = useCreateVendorInvoiceFromReceipt();
  const doCreateInvoice = async () => {
    if (!header) return;
    const answer = await toInvoice.create(header.guid, { taskGUID: header.taskGUID, projectGUID: header.projectGUID });
    setNotice(answer && !answer.documents.length ? answer.skipped.map((x) => pmT(createFromSkippedText(x.reason))).join(' · ') : '');
  };
  const [notice, setNotice] = useState('');
  useEffect(() => setNotice(''), [header?.guid]);
  const missing = header ? productReceiptMissing({ ...header, productReceiptNumber: number, day: parseDayInput(day) ?? '' }, docRows.length) : [];
  const openInBrowserTab = (guid: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(productReceiptDocumentPath(guid), '_blank');
  };

  return (
    <View testID={testID} style={styles.root}>
      {/* the bar: the POST button is the last */}
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="receipt_long" size={20} color={c.primary} />
        <View style={{ flexShrink: 1 }}>
          <Text testID={`${testID}-title`} numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Product receipt')}{header?.partnerTitle ? ` · ${header.partnerTitle}` : header ? ` · ${pmT('No vendor')}` : ''}</Text>
          {header && (
            <Text testID={`${testID}-subtitle`} numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
              {header.number}{header.contractInfo ? ` · ${header.contractInfo}` : ` · ${pmT('no contract')}`}{header.currency ? ` · ${header.currency}` : ''}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }} />
        {header && canDeleteProductReceipt(header) && (
          <ButtonApp testID={`${testID}-delete`} title={pmT('Delete document')} icon="delete" variant="text" danger size="small" disabled={doc.busy} onPress={() => { void doDelete(); }} />
        )}
        {header && canUnpostProductReceipt(header) && (
          <ButtonApp testID={`${testID}-unpost`} title={pmT('Unpost')} icon="undo" variant="outlined" size="small" disabled={doc.busy} onPress={doUnpost} />
        )}
        {header && canCreateInvoiceFromReceipt(header) && (
          <ButtonApp testID={`${testID}-create-based-on`} title={pmT('Create based on')} icon="add_circle" variant="outlined" size="small" disabled={doc.busy || toInvoice.busy} onPress={() => setBasedOnMenu(true)} />
        )}
        {onClose && <ButtonApp testID={`${testID}-close`} title={pmT('Close')} variant="text" size="small" onPress={onClose} />}
        {header && header.status === 'posted' && (
          // a status, not a command: the same BIG button as Post (nothing to press)
          <ButtonApp testID={`${testID}-posted`} title={pmT('Posted')} icon="check" size="large" onPress={() => {}} accessibilityLabel={pmT('Posted')} />
        )}
        {header && canPostProductReceipt(header, docRows.length) && (
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
        <PMProductReceiptDocumentHeader
          testID={testID} header={header} edit={edit} multi={multi} number={number} day={day} dayError={dayError} totals={totals} setHeader={doc.setHeader}
          onNumber={(text) => { setNumber(text); commit({ productReceiptNumber: text }); }}
          onDay={(text) => { setDay(text); const d = parseDayInput(text); if (d) commit({ productReceiptDateTime: `${d}T00:00:00.000Z` }); }}
                  />
      )}

      {!!doc.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{doc.error}</Text>}
      {!!toInvoice.error && <Text testID={`${testID}-create-error`} style={{ color: c.error, padding: 10 }}>{toInvoice.error}</Text>}
      {!!notice && <Text testID={`${testID}-notice`} style={{ color: c.text, opacity: 0.8, paddingHorizontal: 12, paddingTop: 4, fontSize: 12 }}>{notice}</Text>}

      {edit && missing.length > 0 && (
        <Text testID={`${testID}-missing`} style={{ color: c.text, opacity: 0.7, fontSize: 12, paddingHorizontal: 12, paddingTop: 4 }}>{missing.map((m) => pmT(productReceiptProblemText(m))).join(' · ')}</Text>
      )}
      {problems.length > 0 && (
        <View testID={`${testID}-problems`} style={[styles.problems, { borderColor: c.error }]}>
          <Text style={{ color: c.error, fontWeight: '700', marginBottom: 4 }}>{pmT('The document was not posted:')}</Text>
          {problems.map((p, i) => (
            <Text key={`${p.lineGUID}-${i}`} testID={`${testID}-problem-${i}`} style={{ color: c.text, fontSize: 13 }}>• {pmT(productReceiptProblemText(p.problem))}</Text>
          ))}
        </View>
      )}

      <PMProductReceiptDocumentLines
        testID={testID} header={header} tab={tab} onTab={setTab} counts={counts} columns={columns} rowFilter={rowFilter} edit={edit} independent={independent} multi={multi} loading={doc.isLoading}
        onAddLine={(genus) => { if (header) void doc.addLine(header.guid, genus); }}
      />
      {header && (
        <ModalWindowListToSelect
          visible={basedOnMenu} testID={`${testID}-create-based-on-list`} title={pmT('Create based on this product receipt')} message={pmT('The new document opens in a new window.')}
          items={[{ id: 'vendorInvoice', title: pmT('Vendor invoice'), subtitle: pmT('One draft invoice with the received lines that are not invoiced yet'), icon: 'receipt_long' }]} selectedId="" cancelLabel={pmT('Cancel')}
          onClose={() => setBasedOnMenu(false)}
          onSelect={(id) => { setBasedOnMenu(false); if (id === 'vendorInvoice') void doCreateInvoice(); }}
        />
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
