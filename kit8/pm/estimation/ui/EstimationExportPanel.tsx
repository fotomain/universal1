// EstimationExportPanel - the exported documents: choose the estimate documents, the extra forms (resource sheet, summary estimate) and the format. Excel = ONE workbook, a sheet per form,
// the totals are formulas; PDF = one file per form (the PDF of the app: A4 landscape, the header on every page, any alphabet on the web). The wording follows the project switch
// useGOSTInformationInDocuments and the language of the interface.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import SegmentButtonsApp from '../../../ui/components/common/SegmentButtonsApp';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import { readAllPages } from '../../crud/api/apiUtils';
import { createTaskApi } from '../../crud/api/taskApi';
import { pmT } from '../../i18n/pmT';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import { exportTableFile } from '../../../ui/components/table/reusable/tableExportActions';
import { buildTablePdf } from '../../../ui/components/table/reusable/tablePdf';
import { buildLocalEstimateForm, buildQuotationForm, buildResourceSheet, buildSummaryForm, formsToXlsx, formToTextRows, summaryRowsOf, type Form } from '../export/estimationForms';
import { calcDocument } from '../model/estimationCalc';
import type { OutlineTask } from '../model/estimateOutlineModel';
import type { DocumentRow, LineRow } from '../model/estimationDocumentModel';
import { recalcLines } from '../model/estimationDocumentModel';
import { ESTIMATION_TABLES, type EstimationCurrencyBasis } from '../model/estimationModel';

export interface EstimationExportPanelProps {
  client: any;
  projectGUID: string;
  documents: DocumentRow[];
  gost: boolean;
  basis: EstimationCurrencyBasis;
  currency: string;
  summary: { contingencyPct: number; vatPct: number; objectKind: any };
  testID?: string;
}

export const EXPORT_MIME = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf' } as const;

/** every form of the chosen documents (pure given the lines and the tasks). `tasks` = the task tree of the estimation project: its stages are the headings of the forms, its order is theirs */
export function formsFor(args: { documents: DocumentRow[]; linesByDoc: Map<string, LineRow[]>; picked: Set<string>; resources: boolean; summary: boolean; gost: boolean; basis: EstimationCurrencyBasis; currency: string; contingencyPct: number; vatPct: number; objectKind: any; tasks?: readonly OutlineTask[] | null }): Form[] {
  const o = { gost: args.gost, t: pmT, basis: args.basis, currency: args.currency, tasks: args.tasks };
  const forms: Form[] = [];
  const all: { doc: DocumentRow; total: any }[] = [];
  for (const doc of args.documents) {
    const lines = recalcLines(args.linesByDoc.get(doc.rowGUID) ?? [], doc.rowJSON).lines;
    all.push({ doc, total: calcDocument(lines, doc.rowJSON).total });
    if (!args.picked.has(doc.rowGUID)) continue;
    forms.push(doc.rowJSON.docKind === 'bid' ? buildQuotationForm(doc, lines, o) : buildLocalEstimateForm(doc, lines, o));
    if (args.resources && doc.rowJSON.docKind !== 'bid') forms.push(buildResourceSheet(doc, lines, o));
  }
  if (args.summary) forms.push(buildSummaryForm(summaryRowsOf(all), { ...o, contingencyPct: args.contingencyPct, vatPct: args.vatPct, objectKind: args.objectKind }));
  return forms;
}

export default function EstimationExportPanel({ client, projectGUID, documents, gost, basis, currency, summary, testID = 'estimation-export' }: EstimationExportPanelProps) {
  const { themeColors: c } = useDesignSystem();
  const [picked, setPicked] = useState<Set<string>>(new Set(documents.map((d) => d.rowGUID)));
  const [resources, setResources] = useState(false);
  const [withSummary, setWithSummary] = useState(true);
  const [format, setFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pickedAll = useMemo(() => (picked.size ? picked : new Set(documents.map((d) => d.rowGUID))), [picked, documents]);

  const run = async () => {
    setBusy(true); setError(''); setMessage(pmT('Reading the estimate'));
    try {
      const lines = await readAllPages<LineRow>((from, to) => client.from(ESTIMATION_TABLES.line.table).select('*').eq('rowOwnerGUID', projectGUID).order('orderInList').order('rowGUID').range(from, to));
      const linesByDoc = new Map<string, LineRow[]>();
      for (const l of lines) { const d = l.rowJSON.documentGUID; if (!linesByDoc.has(d)) linesByDoc.set(d, []); linesByDoc.get(d)!.push(l); }
      // the stages and the order of the printed forms are those of the task tree
      setMessage(pmT('Reading the tasks'));
      const { tasks } = await createTaskApi(client).readProjectData(projectGUID);
      const forms = formsFor({ tasks, documents, linesByDoc, picked: pickedAll, resources, summary: withSummary, gost, basis, currency, contingencyPct: summary.contingencyPct, vatPct: summary.vatPct, objectKind: summary.objectKind });
      if (!forms.length) { setError(pmT('Nothing is chosen to export.')); setBusy(false); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'xlsx') {
        await exportTableFile({ fileName: `${forms.length === 1 ? forms[0].fileName : pmT('Estimate')}_${stamp}.xlsx`, mimeType: EXPORT_MIME.xlsx, bytes: formsToXlsx(forms) });
      } else {
        for (const f of forms) {
          const { headers, rows } = formToTextRows(f);
          await exportTableFile({ fileName: `${f.fileName}_${stamp}.pdf`, mimeType: EXPORT_MIME.pdf, bytes: buildTablePdf(f.title, f.header.join('  ·  '), headers, rows) });
        }
      }
      setMessage(pmT('Done: {{n}} document(s) exported.', { n: forms.length }));
    } catch (e: any) { setError(String(e?.message ?? e)); setMessage(''); }
    setBusy(false);
  };

  return (
    <ScrollView testID={testID} contentContainerStyle={{ gap: 12, paddingBottom: 30, width: '100%', maxWidth: EXPORT_PANEL_MAX_WIDTH }}>
      <Text style={[styles.h, { color: c.text }]}>{pmT('Documents')}</Text>
      {documents.length === 0 && <Text style={{ color: c.text, opacity: 0.7 }}>{pmT('No estimate yet: make one in the Estimate tab or from an example in the Templates tab.')}</Text>}
      {documents.map((d) => (
        <SwitchApp key={d.rowGUID} testID={`${testID}-doc-${d.rowGUID}`} label={`${d.rowJSON.cipher ? d.rowJSON.cipher + ' · ' : ''}${d.rowJSON.title || pmT('Untitled')}`} value={pickedAll.has(d.rowGUID)} onValueChange={(on) => setPicked((s) => { const x = new Set(pickedAll); if (on) x.add(d.rowGUID); else x.delete(d.rowGUID); return x.size ? x : new Set(); })} />
      ))}
      <SwitchApp testID={`${testID}-resources`} label={pmT('Add the resource sheet of every estimate')} value={resources} onValueChange={setResources} />
      <SwitchApp testID={`${testID}-summary`} label={pmT('Add the summary estimate (chapters 1 - 12)')} value={withSummary} onValueChange={setWithSummary} />
      <Text style={[styles.h, { color: c.text }]}>{pmT('Format')}</Text>
      <SegmentButtonsApp testID={`${testID}-format`} value={format} onValueChange={setFormat} buttons={[{ value: 'xlsx', label: pmT('Excel (.xlsx, totals are formulas)') }, { value: 'pdf', label: pmT('PDF (one file per document)') }]} />
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>
        {gost ? pmT('The wording of the Methodology is used (Project settings -> Estimation).') : pmT('Neutral wording: no country-specific text or form number.')} {pmT('The sums are shown in: {{b}}.', { b: pmT(basis === 'budget' ? 'budget currency' : basis === 'accounting' ? 'accounting currency' : 'consolidation currency') })}
      </Text>
      {!!message && <Text testID={`${testID}-message`} style={{ color: c.text, fontWeight: '600' }}>{message}</Text>}
      {!!error && <Text testID={`${testID}-error`} style={{ color: c.error }}>{error}</Text>}
      <View style={styles.row}><PMDialogButton testID={`${testID}-run`} kind="primary" icon="download" title={pmT('Export')} disabled={busy || !documents.length} loading={busy} onPress={() => { void run(); }} /></View>
    </ScrollView>
  );
}

/** the Export tab is a form: it stays this wide (px) on a wide screen, left justified */
export const EXPORT_PANEL_MAX_WIDTH = 960;

const styles = StyleSheet.create({ h: { fontSize: 15, fontWeight: '700' }, row: { flexDirection: 'row', gap: 10 } });
