// EstimationTemplatesPanel - starting points for INPUT and for OUTPUT:
//   input    three ready estimates (estimate sheet / quick quote / trade breakdown) the user starts from, a CSV input template (the columns of the sheet) and a box where a table copied from Excel or a CSV
//            is pasted and becomes the lines of the open estimate
//   output   the same examples exported as a ready Excel / PDF, so the user sees what the export looks like before he has an estimate of his own
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { exportTableFile } from '../../../ui/components/table/reusable/tableExportActions';
import { buildTablePdf } from '../../../ui/components/table/reusable/tablePdf';
import { pmT } from '../../i18n/pmT';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import { exampleDocument, inputTemplateCsv, linesFromTable, recalcLines, type ExampleKey, type LineRow } from '../model/estimationDocumentModel';
import { buildLocalEstimateForm, buildQuotationForm, buildSummaryForm, formsToXlsx, formToTextRows, summaryRowsOf } from '../export/estimationForms';
import { calcDocument } from '../model/estimationCalc';
import { EXPORT_MIME } from './EstimationExportPanel';

export interface EstimationTemplatesPanelProps {
  projectGUID: string;
  documentGUID: string | null;
  canEdit: boolean;
  gost: boolean;
  currency: string;
  onCreateExample: (key: ExampleKey) => void | Promise<void>;
  onAddLines: (lines: LineRow[]) => void;
  testID?: string;
}

const EXAMPLES: { key: ExampleKey; title: string; text: string }[] = [
  { key: 'estimateSheet', title: 'Estimate sheet', text: 'Sections and positions with norms, units, quantities, coefficients, unit costs of labour, machines and materials, overheads, profit and an index to current prices.' },
  { key: 'quickQuote', title: 'Quick quote', text: 'One line per job: category, description, unit, quantity, cost per unit, mark-up, price and status. Fast for small jobs and quotations.' },
  { key: 'tradeBreakdown', title: 'Trade breakdown', text: 'A section per trade with labour and materials, cost per m2 and share: for concept estimates.' },
];

export default function EstimationTemplatesPanel({ projectGUID, documentGUID, canEdit, gost, currency, onCreateExample, onAddLines, testID = 'estimation-templates' }: EstimationTemplatesPanelProps) {
  const { themeColors: c } = useDesignSystem();
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const o = { gost, t: pmT, basis: 'budget' as const, currency: currency || 'EUR' };

  const exampleForms = () => {
    const sheet = exampleDocument(projectGUID, 'estimateSheet');
    const sLines = recalcLines(sheet.lines, sheet.doc.rowJSON).lines;
    const quote = exampleDocument(projectGUID, 'quickQuote');
    const qLines = recalcLines(quote.lines, quote.doc.rowJSON).lines;
    return [buildLocalEstimateForm(sheet.doc, sLines, o), buildQuotationForm(quote.doc, qLines, o), buildSummaryForm(summaryRowsOf([{ doc: sheet.doc, total: calcDocument(sLines, sheet.doc.rowJSON).total }]), { ...o, contingencyPct: 2, vatPct: 20 })];
  };

  const downloadTemplate = async () => { await exportTableFile({ fileName: 'estimate-input-template.csv', mimeType: 'text/csv', text: inputTemplateCsv(projectGUID) }); };
  const downloadExample = async (format: 'xlsx' | 'pdf') => {
    setBusy(true);
    try {
      const forms = exampleForms();
      if (format === 'xlsx') await exportTableFile({ fileName: 'estimate-example-output.xlsx', mimeType: EXPORT_MIME.xlsx, bytes: formsToXlsx(forms) });
      else { const { headers, rows } = formToTextRows(forms[0]); await exportTableFile({ fileName: 'estimate-example-output.pdf', mimeType: EXPORT_MIME.pdf, bytes: buildTablePdf(forms[0].title, forms[0].header.join('  ·  '), headers, rows) }); }
      setMessage(pmT('The example was exported.'));
    } catch (e: any) { setMessage(String(e?.message ?? e)); }
    setBusy(false);
  };
  const addPasted = () => {
    if (!documentGUID) return;
    const lines = linesFromTable(projectGUID, documentGUID, paste);
    if (!lines.length) { setMessage(pmT('No lines were found: the first row must hold the column names of the input template.')); return; }
    onAddLines(lines);
    setPaste('');
    setMessage(pmT('{{n}} lines were added.', { n: lines.length }));
  };

  return (
    <ScrollView testID={testID} contentContainerStyle={{ gap: 14, paddingBottom: 30 }}>
      <Text style={[styles.h, { color: c.text }]}>{pmT('Start from an example (input)')}</Text>
      <View style={styles.cards}>
        {EXAMPLES.map((e) => (
          <View key={e.key} style={[styles.card, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, fontWeight: '700' }}>{pmT(e.title)}</Text>
            <Text style={{ color: c.text, opacity: 0.75, fontSize: 12, flex: 1 }}>{pmT(e.text)}</Text>
            <PMDialogButton testID={`${testID}-example-${e.key}`} kind="primary" icon="note_add" title={pmT('Make this estimate')} disabled={!canEdit} onPress={() => { void onCreateExample(e.key); }} />
          </View>
        ))}
      </View>
      <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('The numbers of the examples are samples: change them, they are not data of a price book.')}</Text>

      <Text style={[styles.h, { color: c.text }]}>{pmT('Input from a table')}</Text>
      <View style={styles.row}><PMDialogButton testID={`${testID}-download-template`} kind="secondary" icon="download" title={pmT('Download the input template (CSV)')} onPress={() => { void downloadTemplate(); }} /></View>
      <TextInput
        testID={`${testID}-paste`}
        multiline
        value={paste}
        onChangeText={setPaste}
        editable={canEdit && !!documentGUID}
        placeholder={pmT('Paste a table here (CSV or copied from Excel); the first row = the column names of the template')}
        placeholderTextColor={c.text + '88'}
        style={[styles.paste, { color: c.text, borderColor: c.border }]}
      />
      <View style={styles.row}><PMDialogButton testID={`${testID}-add-lines`} kind="primary" icon="playlist_add" title={pmT('Add the lines to the open estimate')} disabled={!canEdit || !documentGUID || !paste.trim()} onPress={addPasted} /></View>

      <Text style={[styles.h, { color: c.text }]}>{pmT('Examples of the output')}</Text>
      <Text style={{ color: c.text, opacity: 0.75, fontSize: 12 }}>{pmT('Local estimate, quotation and summary estimate made from the examples above - to see the documents before you make your own.')}</Text>
      <View style={styles.row}>
        <PMDialogButton testID={`${testID}-example-xlsx`} kind="secondary" icon="table_chart" title={pmT('Example output: Excel')} disabled={busy} onPress={() => { void downloadExample('xlsx'); }} />
        <PMDialogButton testID={`${testID}-example-pdf`} kind="secondary" icon="picture_as_pdf" title={pmT('Example output: PDF')} disabled={busy} onPress={() => { void downloadExample('pdf'); }} />
      </View>
      {!!message && <Text testID={`${testID}-message`} style={{ color: c.text, fontWeight: '600' }}>{message}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 15, fontWeight: '700' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: 300, minHeight: 170, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paste: { minHeight: 110, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 12, textAlignVertical: 'top' },
});
