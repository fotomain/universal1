// VendorInvoiceDocumentForm - the FORM of vendor invoices (documentation/PROJECT_STATE_WBS.html). ONE document = ONE vendor + ONE contract.
//
//   documents   the route gives one or MORE documents (the vendors the user checked in the choice window): a TAB for each (vendor · contract). On the web a real BROWSER TAB of its own can be opened for
//               each document (the icon on the tab; the choice window opens one for every document it made); on a phone the tab strip is the tab bar.
//   the bar     Delete · Unpost · Create based on… (→ Payment fact, a POSTED invoice: PaymentFactBasedOn) · Close - and the POST button is the LAST (a large button; the Posted state is the same size)
//   header      TextInputApp / DateInputApp / the catalog select: document number · legal entity · vendor · contract · currency (read only) · the NUMBER printed on the invoice · its DATE · the totals
//   DocumentTabs All (default) · Time · Material · Expenses, with the number of lines of each - the same look as the Finances table of a task
//   the lines   a ReusableTable on the redux entity VENDOR_INVOICE_LINES_ENTITY (VendorInvoiceLines; realtime, optimistic): quantity, price and VAT % of a DRAFT are editable and can be deleted; no new
//               lines (they come from the task lines); a posted document is read only. Columns: vendorInvoiceColumns.tsx.
// MULTI PROJECT (project setting multiProjectVendorInvoceNeeded): a chevron button at the left of the Project field chooses Single Project | Multi Project (saved at once). In Multi Project the lines table gets
//   vendorInvoiceLineProject (read only) · vendorInvoiceTaskGUID · vendorInvoiceTaskLineGUID: on a DRAFT each of the two GUIDs is pasted from the clipboard (variant 1: "Copy GUID" of the task tree, "Copy line GUID" of the
//   Finances line), selected in the project tree window (variant 2: PMProjectPickerModal = the dashboard with the Finances view, press to select) or cleared. The lines table of the SQL RPC vendor_invoice_set_line_task.
// Post checks the whole document (the problems are listed) and writes the 'invoiced' movements of the project status register in the same transaction. The 0333Effect correction is not built yet.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow } from '../../../ui/components/table/reusable/reusableTableTypes';
import SelectElementFromCatalog from '../../../catalog/inner/select_element/SelectElementFromCatalog';
import { LEGAL_ENTITY_TABLE, legalEntityTitle } from '../../../catalog/legal_entity/legalEntityModel';
import { PARTNER_CATALOG_OWNER, PARTNER_ENTITY } from '../../../catalog/partner/partnerModel';
import { CONTRACT_ENTITY } from '../../../catalog/contract/contractModel';
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import { useTaskLineCatalogs } from '../../../pm/view/task/finances/useTaskLineCatalogs';
import { parseDayInput } from '../../fact/input/factInputModel';
import ModalWindowListToSelect from '../../../ui/components/common/ModalWindowListToSelect';
import type { PMPickedPlace } from '../../../pm/view/project/pick/pmPickerContext';
import { extractGUID, placeChange, placesSignature } from '../lineplace/linePlaceModel';
import { useDocumentLineMenu } from '../lineplace/useDocumentLineMenu';
import PaymentFactBasedOn from '../../payment/fact/PaymentFactBasedOn';
import type { PlaceField } from '../lineplace/linePlaceModel';
import { pmT } from '../../../pm/i18n/pmT';
import { buildVendorInvoiceColumns } from './vendorInvoiceColumns';
import {
  VENDOR_INVOICE_ALL_TAB, VENDOR_INVOICE_LINES_ENTITY, VENDOR_INVOICE_PROJECT_MODES, VENDOR_INVOICE_TABS, VendorInvoicePostProblem, canChooseProjectMode, canDeleteVendorInvoice, canEditVendorInvoice, canPostVendorInvoice, canUnpostVendorInvoice,
  formatMoney, vendorInvoiceDocumentPath, vendorInvoiceLinesOf, vendorInvoiceMissing, vendorInvoiceProblemText, vendorInvoiceTotals,
} from './vendorInvoiceModel';
import { useVendorInvoiceDocuments, useVendorInvoiceLinePlaces } from './useVendorInvoice';
import ScrollableTabBar from '../../../ui/components/tabs/ScrollableTabBar';

// the project tree window (it carries the whole dashboard, Skia included) is loaded when the user opens it
const PMProjectPickerModal = React.lazy(() => Promise.resolve(require('../../../pm/view/project/pick/PMProjectPickerModal')));

export interface VendorInvoiceDocumentFormProps {
  /** the documents of the form: one tab each (the first is open) */
  documents: string[];
  onClose?: () => void;
  testID?: string;
}

export default function VendorInvoiceDocumentForm({ documents, onClose, testID = 'vendor-invoice' }: VendorInvoiceDocumentFormProps) {
  const { themeColors: c } = useDesignSystem();
  const data = useTaskLineCatalogs(true);
  const doc = useVendorInvoiceDocuments(documents);
  // the Task context menu items on a line (Open task, Facts input, Vendor Invoice, Purchase Order, Copy GUID ...)
  const lineMenu = useDocumentLineMenu(`${testID}-lines`);
  const [selected, setSelected] = useState<string>(documents[0] ?? '');
  const [tab, setTab] = useState<string>(VENDOR_INVOICE_ALL_TAB);
  const [problems, setProblems] = useState<VendorInvoicePostProblem[]>([]);
  // the documents the route names, in its order; one that is not (yet) readable is left out
  const header = doc.headers.find((h) => h.guid === selected) ?? doc.headers[0] ?? null;
  useEffect(() => { if (documents.length && !documents.includes(selected)) setSelected(documents[0]); }, [documents, selected]);

  // the lines the table holds (redux): the counts of the tabs, the totals, Post needs lines
  const allRows: any[] = useSelector((s: any) => s?.[VENDOR_INVOICE_LINES_ENTITY]?.entityDataFromServer) ?? [];
  const docRows = useMemo(() => vendorInvoiceLinesOf(allRows, header?.guid), [allRows, header?.guid]);
  const totals = useMemo(() => vendorInvoiceTotals(docRows), [docRows]);
  const counts = useMemo(() => Object.fromEntries(VENDOR_INVOICE_TABS.map((t) => [t.id, vendorInvoiceLinesOf(docRows, header?.guid, t.id).length])), [docRows, header?.guid]);
  useEffect(() => setProblems([]), [header?.guid]);

  const edit = !!header && canEditVendorInvoice(header);
  // an UNPOSTED document lets its vendor and contract be chosen / changed (saved at once); the project setting independentInvoiceInputAvailable lets lines be ADDED by hand (not tied to a task line)
  const independent = edit && !!header?.independentInputAvailable;

  // ---- Single Project | Multi Project: the chevron at the left of the Project field; in Multi each line has a task / task line (paste · select in the project tree · clear) ----
  const multi = !!header?.multiProject;
  const [modeMenu, setModeMenu] = useState(false);
  const [pickFor, setPickFor] = useState<{ rowGUID: string; field: PlaceField } | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const places = useVendorInvoiceLinePlaces(header?.guid, placesSignature(docRows), multi);
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
  const columns = useMemo(() => buildVendorInvoiceColumns({ data, tab, editable: edit, independent, multiProject: multi, places, placeActions }), [data, tab, edit, independent, multi, places, placeActions]);
  const rowFilter = useMemo(() => {
    const guid = header?.guid;
    return (r: ReusableTableRow) => !!guid && r.rowHeaderGUID === guid && (tab === VENDOR_INVOICE_ALL_TAB || r.genusGUID === tab);
  }, [header?.guid, tab]);

  // the number and the date printed on the invoice: typed here, saved a moment after the last key (a valid day only)
  const [number, setNumber] = useState('');
  const [day, setDay] = useState('');
  useEffect(() => { setNumber(header?.vendorInvoiceNumber ?? ''); setDay(header?.day ?? ''); }, [header?.guid, header?.vendorInvoiceNumber, header?.day]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const commit = (patch: { vendorInvoiceNumber?: string; vendorInvoiceDateTime?: string | null }) => {
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
  const missing = header ? vendorInvoiceMissing({ ...header, vendorInvoiceNumber: number, day: parseDayInput(day) ?? '' }, docRows.length) : [];
  const openInBrowserTab = (guid: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(vendorInvoiceDocumentPath(guid), '_blank');
  };

  return (
    <View testID={testID} style={styles.root}>
      {/* the bar: the POST button is the last */}
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="receipt_long" size={20} color={c.primary} />
        <View style={{ flexShrink: 1 }}>
          <Text testID={`${testID}-title`} numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Vendor invoice')}{header?.partnerTitle ? ` · ${header.partnerTitle}` : header ? ` · ${pmT('No vendor')}` : ''}</Text>
          {header && (
            <Text testID={`${testID}-subtitle`} numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
              {header.number}{header.contractInfo ? ` · ${header.contractInfo}` : ` · ${pmT('no contract')}`}{header.currency ? ` · ${header.currency}` : ''}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }} />
        {header && canDeleteVendorInvoice(header) && (
          <ButtonApp testID={`${testID}-delete`} title={pmT('Delete document')} icon="delete" variant="text" danger size="small" disabled={doc.busy} onPress={() => { void doDelete(); }} />
        )}
        {header && canUnpostVendorInvoice(header) && (
          <ButtonApp testID={`${testID}-unpost`} title={pmT('Unpost')} icon="undo" variant="outlined" size="small" disabled={doc.busy} onPress={doUnpost} />
        )}
        {header && <PaymentFactBasedOn kind="vendor" invoiceGUID={header.guid} status={header.status} disabled={doc.busy} testID={testID} />}
        {onClose && <ButtonApp testID={`${testID}-close`} title={pmT('Close')} variant="text" size="small" onPress={onClose} />}
        {header && header.status === 'posted' && (
          // a status, not a command: the same BIG button as Post (nothing to press)
          <ButtonApp testID={`${testID}-posted`} title={pmT('Posted')} icon="check" size="large" onPress={() => {}} accessibilityLabel={pmT('Posted')} />
        )}
        {header && canPostVendorInvoice(header, docRows.length) && (
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

      {/* the form of the document */}
      {header && (
        <View testID={`${testID}-form`} style={styles.form}>
          {/* every field is a TextInputApp (the selects too: asInput) without its outer margin, so the boxes of the row have the same height and are centered on one line */}
          <View style={{ width: 130 }}>
            <TextInputApp testID={`${testID}-field-number`} label={pmT('Document')} value={header.number} compact disabled hideClearIcon style={FIELD} />
          </View>
          <View style={styles.projectField}>
            {/* Single Project | Multi Project (project setting multiProjectVendorInvoceNeeded): the chevron at the left of the Project field */}
            {canChooseProjectMode(header) && (
              <Pressable testID={`${testID}-project-mode`} accessibilityRole="button" accessibilityLabel={pmT('Single Project | Multi Project')} onPress={() => setModeMenu(true)} hitSlop={6} style={styles.chevron}>
                <IconApp name="expand_more" size={22} color={c.primary} />
              </Pressable>
            )}
            <View style={{ width: 200 }}>
              {/* the project of the document (vendorInvoiceProject): its setting independentInvoiceInputAvailable decides whether lines can be added */}
              <TextInputApp testID={`${testID}-field-project`} label={multi ? pmT('Project · Multi Project') : pmT('Project')} value={header.projectName || ''} compact disabled hideClearIcon style={FIELD} />
            </View>
          </View>
          <View style={{ width: 230 }}>
            {edit ? (
              <SelectElementFromCatalog
                testID={`${testID}-field-legalEntity`} entityName={LEGAL_ENTITY_TABLE.entity} label={pmT('Legal entity')} placeholder={pmT('Select legal entity…')} compact asInput
                value={header.legalEntityGUID || null} titleExtractor={legalEntityTitle}
                onChange={(guid) => { if (guid) void doc.setHeader(header.guid, { legalEntityGUID: guid }); }}
              />
            ) : (
              <TextInputApp testID={`${testID}-field-legalEntity`} label={pmT('Legal entity')} value={header.legalEntityTitle} compact disabled hideClearIcon style={FIELD} />
            )}
          </View>
          {edit ? (
            // an unposted document: the vendor and its contract are chosen / changed here and saved AT ONCE (until Post; a new vendor drops the contract of the old one)
            <>
              <View style={{ width: 210 }}>
                <SelectElementFromCatalog
                  testID={`${testID}-field-vendor`} entityName={PARTNER_ENTITY} rowOwnerGUID={PARTNER_CATALOG_OWNER} label={pmT('Vendor')} placeholder={pmT('Select vendor…')} compact asInput
                  value={header.partnerGUID || null} onChange={(guid) => { void doc.setHeader(header.guid, { vendorInvoicePartner: guid ?? '' }); }}
                />
              </View>
              <View style={{ width: 230 }}>
                <SelectElementFromCatalog
                  testID={`${testID}-field-contract`} entityName={CONTRACT_ENTITY} rowParentGUID="partner" rowOwnerGUID={header.partnerGUID || undefined} label={pmT('Contract')} placeholder={pmT('Select contract…')} compact asInput
                  value={header.contractGUID || null} disabled={!header.partnerGUID} disabledMessage={pmT('Select a vendor first')} onChange={(guid) => { void doc.setHeader(header.guid, { vendorInvoiceContract: guid ?? '' }); }}
                />
              </View>
            </>
          ) : (
            <>
              <View style={{ width: 210 }}>
                <TextInputApp testID={`${testID}-field-vendor`} label={pmT('Vendor')} value={header.partnerTitle} compact disabled hideClearIcon style={FIELD} />
              </View>
              <View style={{ width: 230 }}>
                <TextInputApp testID={`${testID}-field-contract`} label={pmT('Contract')} value={header.contractInfo} compact disabled hideClearIcon style={FIELD} />
              </View>
            </>
          )}
          <View style={{ width: 90 }}>
            <TextInputApp testID={`${testID}-field-currency`} label={pmT('Currency')} value={header.currency} compact disabled hideClearIcon style={FIELD} />
          </View>
          <View style={{ width: 190 }}>
            <TextInputApp
              testID={`${testID}-field-invoiceNumber`} label={pmT('Invoice number')} value={number} compact disabled={!edit} style={FIELD}
              onChangeText={(t: string) => { setNumber(t); commit({ vendorInvoiceNumber: t }); }}
            />
          </View>
          <View style={{ width: 200 }}>
            <DateInputApp
              testID={`${testID}-field-invoiceDate`} label={pmT('Invoice date')} value={day} compact disabled={!edit} error={dayError} style={FIELD}
              onChangeText={(t: string) => { setDay(t); const d = parseDayInput(t); if (d) commit({ vendorInvoiceDateTime: `${d}T00:00:00.000Z` }); }}
            />
          </View>
          <View testID={`${testID}-totals`} style={styles.totals}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{pmT('Document total')} · {totals.lineCount} {pmT('lines')}{header.currency ? ` · ${header.currency}` : ''}</Text>
            <Text testID={`${testID}-total-before`} style={{ color: c.text, fontSize: 12 }}>{pmT('Sum before VAT')} {formatMoney(totals.sumBeforeVAT)}</Text>
            <Text testID={`${testID}-total-vat`} style={{ color: c.text, fontSize: 12 }}>{pmT('VAT')} {formatMoney(totals.sumVAT)}</Text>
            <Text testID={`${testID}-total-with`} style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{pmT('Sum with VAT')} {formatMoney(totals.sumWithVAT)}</Text>
          </View>
        </View>
      )}

      {!!doc.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{doc.error}</Text>}
      {!!placeError && <Text testID={`${testID}-place-error`} style={{ color: c.error, paddingHorizontal: 12, paddingTop: 4, fontSize: 12 }}>{placeError}</Text>}

      {edit && missing.length > 0 && (
        <Text testID={`${testID}-missing`} style={{ color: c.text, opacity: 0.7, fontSize: 12, paddingHorizontal: 12, paddingTop: 4 }}>{missing.map((m) => pmT(vendorInvoiceProblemText(m))).join(' · ')}</Text>
      )}
      {problems.length > 0 && (
        <View testID={`${testID}-problems`} style={[styles.problems, { borderColor: c.error }]}>
          <Text style={{ color: c.error, fontWeight: '700', marginBottom: 4 }}>{pmT('The document was not posted:')}</Text>
          {problems.map((p, i) => (
            <Text key={`${p.lineGUID}-${i}`} testID={`${testID}-problem-${i}`} style={{ color: c.text, fontSize: 13 }}>• {pmT(vendorInvoiceProblemText(p.problem))}</Text>
          ))}
        </View>
      )}

      {/* DocumentTabs: All (default) · Time · Material · Expenses */}
      <ScrollableTabBar testID={`${testID}-tabs`} style={[styles.tabs, { borderBottomColor: c.border }]}>
        {VENDOR_INVOICE_TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable key={t.id} accessibilityRole="tab" aria-selected={active} testID={`${testID}-tab-${t.id}`} onPress={() => setTab(t.id)} style={[styles.tab, { borderBottomColor: active ? c.primary : 'transparent' }]}>
              <IconApp name={t.icon} size={16} color={active ? c.primary : c.text} />
              <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{pmT(t.title)}</Text>
              {!!counts[t.id] && (
                <View testID={`${testID}-tab-${t.id}-count`} style={[styles.badge, { backgroundColor: c.primary }]}>
                  <Text style={styles.badgeText}>{counts[t.id] > 99 ? '99+' : String(counts[t.id])}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollableTabBar>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {doc.isLoading && <Text style={{ color: c.text, opacity: 0.6 }}>{pmT('Loading…')}</Text>}
        {header && (
          <ReusableTable
            key={`${header.guid}:${tab}:${header.status}:${multi ? 'multi' : 'single'}`}
            testID={`${testID}-lines`}
            entityName={VENDOR_INVOICE_LINES_ENTITY}
            crudListTitle={pmT('Invoice lines')}
            itemLabel="Line"
            listOwnerGUID={REUSABLE_TABLE_ALL}
            listParentGUID={REUSABLE_TABLE_ALL}
            // the lines of THIS document are read (a document can have lines of several tasks); the table filters the tab
            readParams={{ match: { rowHeaderGUID: header.guid } }}
            rowFilter={rowFilter}
            visualColumns={columns}
            // independent input (project setting): the + adds a line of the kind of the tab (All: Time) by the database, not tied to a task line; otherwise the lines come from the task lines only
            addEnabled={independent}
            onAdd={independent ? () => { void doc.addLine(header.guid, VENDOR_INVOICE_TABS.find((t) => t.id === tab)?.genus ?? MANAGEMENT_GENUS.time); } : undefined}
            crudPanelEnabled={edit}
            contextMenuEnabled={edit}
            extraMenuItems={lineMenu}
            selectionEnabled={edit}
            reorderEnabled={false}
            dragAndDropColumns
            resizeColumnWidth
            realtime
            emptyText={pmT('No lines.')}
            uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
          />
        )}
        {header && (
          <>
            <ModalWindowListToSelect
              visible={modeMenu} testID={`${testID}-project-mode-list`} title={pmT('Project mode')} message={pmT('Single Project: all the lines belong to the project of the document. Multi Project: each line can belong to any task or task line of your projects.')}
              items={VENDOR_INVOICE_PROJECT_MODES.map((m) => ({ id: m.id, title: pmT(m.title), subtitle: pmT(m.subtitle), icon: m.icon }))} selectedId={multi ? 'multi' : 'single'} cancelLabel={pmT('Cancel')}
              onClose={() => setModeMenu(false)}
              onSelect={(id) => { setModeMenu(false); if ((id === 'multi') !== multi) void doc.setHeader(header.guid, { vendorInvoiceMultiProject: id === 'multi' }); }}
            />
            {!!pickFor && (
              <React.Suspense fallback={null}>
                <PMProjectPickerModal testID={`${testID}-picker`} visible mode={pickFor.field === 'taskLine' ? 'line' : 'task'} onPick={onPicked} onClose={() => setPickFor(null)} />
              </React.Suspense>
            )}
          </>
        )}
        {!header && !doc.isLoading && <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.6 }}>{pmT('The vendor invoice was not found.')}</Text>}
      </ScrollView>
    </View>
  );
}

/** no outer margin: the boxes of the form row are centered on one line */
const FIELD = { marginBottom: 0 };

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  docTabs: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  docTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 2 },
  docTabText: { maxWidth: 240 },
  projectField: { flexDirection: 'row', alignItems: 'center' },
  chevron: { paddingRight: 2 },
  form: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingBottom: 8, marginLeft: 8 },
  problems: { margin: 12, padding: 10, borderWidth: 1, borderRadius: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 14, borderBottomWidth: 2 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { padding: 12, paddingBottom: 24 },
});
